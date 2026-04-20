import { db } from '@/utils/db';
import { embedText } from '@/utils/embeddings';
import { logger } from '@/utils/log';
import type { MemoryType, MemoryCategory, MemorySource } from '@/generated/prisma/client';

export type MemoryCandidate = {
  content: string;
  summary: string;
  memoryType: MemoryType;
  category: MemoryCategory;
  confidence: number;
  importance: number;
  source: MemorySource;
  entities?: Record<string, string | number | boolean | null>;
  expiresAt?: Date;
};

// Thresholds for similarity-based deduplication
const SIMILARITY_SKIP_THRESHOLD = 0.92; // too similar — skip write, just bump access
const SIMILARITY_SUPERSEDE_THRESHOLD = 0.8; // similar enough to supersede old

export async function writeMemory(userId: string, candidate: MemoryCandidate): Promise<void> {
  const embedding = await embedText(candidate.content);

  // Check for near-duplicate active memories
  const similar = await findSimilarMemories(userId, embedding, candidate.memoryType);

  for (const { id: existingId, similarity } of similar) {
    if (similarity >= SIMILARITY_SKIP_THRESHOLD) {
      // Memory already exists effectively — just refresh access
      await markAccessed(existingId);
      logger.info('[memory] Skipped duplicate write, bumped access', { userId, existingId, similarity });
      return;
    }

    if (similarity >= SIMILARITY_SUPERSEDE_THRESHOLD) {
      // New memory supersedes the old one — write new, archive old
      const newMemory = await createMemoryRow(userId, candidate);
      await setMemoryEmbedding(newMemory.id, embedding);
      await supersede(existingId, newMemory.id);
      logger.info('[memory] Superseded old memory', { userId, oldId: existingId, newId: newMemory.id });
      return;
    }
  }

  // No close duplicate found — write fresh
  const newMemory = await createMemoryRow(userId, candidate);
  await setMemoryEmbedding(newMemory.id, embedding);

  logger.info('[memory] Wrote new memory', { userId, type: candidate.memoryType, category: candidate.category });
}

export async function markAccessed(memoryId: string): Promise<void> {
  await db.memory.update({
    where: { id: memoryId },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  });
}

export async function supersede(oldId: string, newId: string): Promise<void> {
  await db.memory.update({
    where: { id: oldId },
    data: { status: 'SUPERSEDED', supersededById: newId },
  });
}

export async function getActiveMemories(userId: string, memoryType?: MemoryType) {
  return db.memory.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      ...(memoryType ? { memoryType } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function findSimilarMemories(
  userId: string,
  embedding: number[],
  memoryType: MemoryType,
): Promise<Array<{ id: string; similarity: number }>> {
  const vectorLiteral = `[${embedding.join(',')}]`;

  // Raw query needed for pgvector cosine similarity operator
  const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>`
    SELECT id, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM memories
    WHERE user_id = ${userId}
      AND status = 'ACTIVE'
      AND memory_type = ${memoryType}::"MemoryType"
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT 5
  `;

  return rows;
}

// Creates a memory row without the embedding field (Unsupported type excluded from Prisma input types).
// Caller must call setMemoryEmbedding() after to populate the vector.
async function createMemoryRow(userId: string, candidate: MemoryCandidate) {
  return db.memory.create({
    data: {
      userId,
      memoryType: candidate.memoryType,
      category: candidate.category,
      content: candidate.content,
      summary: candidate.summary,
      entities: candidate.entities ?? undefined,
      confidence: candidate.confidence,
      importance: candidate.importance,
      source: candidate.source,
      expiresAt: candidate.expiresAt ?? null,
    },
  });
}

async function setMemoryEmbedding(memoryId: string, embedding: number[]): Promise<void> {
  const vectorLiteral = `[${embedding.join(',')}]`;
  await db.$executeRaw`UPDATE memories SET embedding = ${vectorLiteral}::vector WHERE id = ${memoryId}`;
}
