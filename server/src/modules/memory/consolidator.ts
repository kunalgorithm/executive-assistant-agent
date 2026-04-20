import { db } from '@/utils/db';
import { ai } from '@/utils/gemini';
import { logger } from '@/utils/log';
import { embedText } from '@/utils/embeddings';
import { GEMINI_FLASH3_MODEL } from '@/utils/constants';

const DEDUPE_SIMILARITY_THRESHOLD = 0.88;
const PROMOTE_ACCESS_THRESHOLD = 3;
const STALE_WORK_CONTEXT_DAYS = 14;

export async function runConsolidation(userId: string): Promise<void> {
  logger.info('[memory] Running consolidation', { userId });

  await archiveExpiredEpisodic(userId);
  await archiveStaleWorkContext(userId);
  await dedupeNearDuplicates(userId);
  await promoteEpisodicToSemantic(userId);

  logger.info('[memory] Consolidation complete', { userId });
}

async function archiveExpiredEpisodic(userId: string): Promise<void> {
  const result = await db.memory.updateMany({
    where: {
      userId,
      category: 'EPISODIC',
      status: 'ACTIVE',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'ARCHIVED' },
  });

  if (result.count > 0) {
    logger.info('[memory] Archived expired episodic memories', { userId, count: result.count });
  }
}

async function archiveStaleWorkContext(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_WORK_CONTEXT_DAYS * 24 * 60 * 60 * 1000);

  const result = await db.memory.updateMany({
    where: {
      userId,
      memoryType: 'WORK_CONTEXT',
      status: 'ACTIVE',
      OR: [{ lastAccessedAt: { lt: cutoff } }, { lastAccessedAt: null, createdAt: { lt: cutoff } }],
    },
    data: { status: 'ARCHIVED' },
  });

  if (result.count > 0) {
    logger.info('[memory] Archived stale work context memories', { userId, count: result.count });
  }
}

async function dedupeNearDuplicates(userId: string): Promise<void> {
  // Fetch all active memories that have embeddings, grouped by type
  const memories = await db.$queryRaw<
    Array<{ id: string; memory_type: string; content: string; confidence: number; embedding: string | null }>
  >`
    SELECT id, memory_type, content, confidence, embedding::text
    FROM memories
    WHERE user_id = ${userId}
      AND status = 'ACTIVE'
      AND embedding IS NOT NULL
    ORDER BY memory_type, confidence DESC
  `;

  const archived = new Set<string>();

  // Compare within each memory type
  const byType = new Map<string, typeof memories>();
  for (const mem of memories) {
    const group = byType.get(mem.memory_type) ?? [];
    group.push(mem);
    byType.set(mem.memory_type, group);
  }

  for (const [_type, group] of byType) {
    for (let i = 0; i < group.length; i++) {
      const memI = group[i];
      if (!memI || archived.has(memI.id)) continue;

      for (let j = i + 1; j < group.length; j++) {
        const memJ = group[j];
        if (!memJ || archived.has(memJ.id)) continue;

        const similarity = await cosineSimilarityRaw(userId, memI.id, memJ.id);
        if (similarity >= DEDUPE_SIMILARITY_THRESHOLD) {
          // Keep the one with higher confidence; archive the other
          const toArchive = memI.confidence >= memJ.confidence ? memJ.id : memI.id;
          await db.memory.update({ where: { id: toArchive }, data: { status: 'ARCHIVED' } });
          archived.add(toArchive);
          logger.info('[memory] Archived near-duplicate', { userId, archivedId: toArchive, similarity });
        }
      }
    }
  }
}

async function promoteEpisodicToSemantic(userId: string): Promise<void> {
  // Find episodic memories accessed enough times to become stable facts
  const candidates = await db.memory.findMany({
    where: {
      userId,
      category: 'EPISODIC',
      status: 'ACTIVE',
      accessCount: { gte: PROMOTE_ACCESS_THRESHOLD },
    },
  });

  for (const candidate of candidates) {
    try {
      const refinedSummary = await refineForPromotion(candidate.content, candidate.summary);
      const embedding = await embedText(candidate.content);

      const promoted = await db.memory.create({
        data: {
          userId,
          memoryType: candidate.memoryType,
          category: 'SEMANTIC',
          status: 'ACTIVE',
          content: candidate.content,
          summary: refinedSummary,
          confidence: Math.min(candidate.confidence + 0.05, 1.0),
          importance: candidate.importance,
          source: 'SYSTEM',
        },
      });

      // Set embedding via raw query — Unsupported types are excluded from Prisma's generated TS input types
      const embeddingLiteral = `[${embedding.join(',')}]`;
      await db.$executeRaw`UPDATE memories SET embedding = ${embeddingLiteral}::vector WHERE id = ${promoted.id}`;

      await db.memory.update({
        where: { id: candidate.id },
        data: { status: 'ARCHIVED' },
      });

      logger.info('[memory] Promoted episodic to semantic', { userId, episodicId: candidate.id });
    } catch (error) {
      logger.warn('[memory] Failed to promote episodic memory', {
        userId,
        memoryId: candidate.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

async function refineForPromotion(content: string, currentSummary: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: {
        systemInstruction:
          'Rewrite the following fact as a stable, timeless preference or rule (≤20 words). Plain text only.',
        temperature: 0.1,
        maxOutputTokens: 60,
      },
      contents: [{ role: 'user', parts: [{ text: `Fact: ${content}\nCurrent summary: ${currentSummary}` }] }],
    });

    return response.text?.trim() ?? currentSummary;
  } catch {
    return currentSummary;
  }
}

async function cosineSimilarityRaw(userId: string, idA: string, idB: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ similarity: number }>>`
    SELECT 1 - (a.embedding <=> b.embedding) AS similarity
    FROM memories a, memories b
    WHERE a.id = ${idA}
      AND b.id = ${idB}
      AND a.user_id = ${userId}
      AND b.user_id = ${userId}
  `;

  return rows[0]?.similarity ?? 0;
}
