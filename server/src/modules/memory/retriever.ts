import { db } from '@/utils/db';
import { embedText } from '@/utils/embeddings';
import { ai } from '@/utils/gemini';
import { logger } from '@/utils/log';
import { GEMINI_FLASH3_MODEL } from '@/utils/constants';
import type { MemoryType } from '@/generated/prisma/client';

type RetrievedMemory = {
  id: string;
  summary: string;
  content: string;
  memoryType: string;
  confidence: number;
  importance: number;
  createdAt: Date;
  score: number;
};

const RETRIEVAL_TOP_K = 8;
const PACKET_TOP_K = 4;
const RECENCY_DECAY_DAYS = 30;

// Intent → which memory types to prioritize
const INTENT_TYPE_MAP: Record<string, MemoryType[]> = {
  SCHEDULING: ['SCHEDULING', 'PEOPLE'],
  PEOPLE: ['PEOPLE', 'COMMUNICATION'],
  COMMUNICATION: ['COMMUNICATION', 'PEOPLE'],
  WORK_CONTEXT: ['WORK_CONTEXT', 'SCHEDULING'],
};

export type MemoryIntent = 'SCHEDULING' | 'PEOPLE' | 'COMMUNICATION' | 'WORK_CONTEXT' | 'NONE';

export function classifyIntent(userMessage: string): MemoryIntent {
  const msg = userMessage.toLowerCase();

  if (
    /\b(schedul|meeting|calendar|availab|call|appoint|slot|time|block|reschedul|book|when|tomorrow|monday|tuesday|wednesday|thursday|friday|weekend|morning|afternoon|evening|week)\b/.test(
      msg,
    )
  ) {
    return 'SCHEDULING';
  }

  if (/\b(email|inbox|reply|send|draft|message|respond|thread|unread|follow.?up on)\b/.test(msg)) {
    return 'COMMUNICATION';
  }

  if (
    /\b(last time|you mentioned|continue|remember|we were|from before|previous|earlier|open loop|follow.?up|remind|pending)\b/.test(
      msg,
    )
  ) {
    return 'WORK_CONTEXT';
  }

  // Check for person mentions (capitalized words that aren't sentence starts)
  if (/(?<![.!?]\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)?/.test(userMessage)) {
    return 'PEOPLE';
  }

  return 'NONE';
}

export async function retrieveMemories(userId: string, userMessage: string): Promise<RetrievedMemory[]> {
  const intent = classifyIntent(userMessage);
  if (intent === 'NONE') return [];

  const relevantTypes =
    INTENT_TYPE_MAP[intent] ?? (['SCHEDULING', 'PEOPLE', 'COMMUNICATION', 'WORK_CONTEXT'] as MemoryType[]);
  const embedding = await embedText(userMessage);

  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(userId, embedding, relevantTypes),
    fullTextSearch(userId, userMessage, relevantTypes),
  ]);

  // Merge and dedupe by id
  const merged = new Map<string, RetrievedMemory>();
  for (const result of [...vectorResults, ...ftsResults]) {
    if (!merged.has(result.id)) merged.set(result.id, result);
  }

  // Score and rank
  const now = Date.now();
  const scored = Array.from(merged.values()).map((mem) => {
    const ageMs = now - mem.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0, 1 - ageDays / RECENCY_DECAY_DAYS);
    const score = 0.5 * mem.score + 0.25 * recencyWeight + 0.15 * mem.confidence + 0.1 * mem.importance;
    return { ...mem, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, PACKET_TOP_K);
}

async function vectorSearch(
  userId: string,
  embedding: number[],
  memoryTypes: MemoryType[],
): Promise<RetrievedMemory[]> {
  const vectorLiteral = `[${embedding.join(',')}]`;
  const typeList = memoryTypes.join("','");

  const rows = await db.$queryRaw<
    Array<{
      id: string;
      summary: string;
      content: string;
      memory_type: string;
      confidence: number;
      importance: number;
      created_at: Date;
      similarity: number;
    }>
  >`
    SELECT id, summary, content, memory_type, confidence, importance, created_at,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM memories
    WHERE user_id = ${userId}
      AND status = 'ACTIVE'
      AND memory_type = ANY(ARRAY[${typeList}]::"MemoryType"[])
      AND embedding IS NOT NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${RETRIEVAL_TOP_K}
  `;

  return rows.map((r) => ({
    id: r.id,
    summary: r.summary,
    content: r.content,
    memoryType: r.memory_type,
    confidence: r.confidence,
    importance: r.importance,
    createdAt: r.created_at,
    score: r.similarity,
  }));
}

async function fullTextSearch(
  userId: string,
  userMessage: string,
  memoryTypes: MemoryType[],
): Promise<RetrievedMemory[]> {
  // Build a tsquery from significant words in the user message (min 3 chars)
  const words = userMessage
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 8)
    .join(' | ');

  if (!words) return [];

  const typeList = memoryTypes.join("','");

  const rows = await db.$queryRaw<
    Array<{
      id: string;
      summary: string;
      content: string;
      memory_type: string;
      confidence: number;
      importance: number;
      created_at: Date;
      rank: number;
    }>
  >`
    SELECT id, summary, content, memory_type, confidence, importance, created_at,
           ts_rank(to_tsvector('english', content), to_tsquery('english', ${words})) AS rank
    FROM memories
    WHERE user_id = ${userId}
      AND status = 'ACTIVE'
      AND memory_type = ANY(ARRAY[${typeList}]::"MemoryType"[])
      AND to_tsvector('english', content) @@ to_tsquery('english', ${words})
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY rank DESC
    LIMIT ${RETRIEVAL_TOP_K}
  `;

  return rows.map((r) => ({
    id: r.id,
    summary: r.summary,
    content: r.content,
    memoryType: r.memory_type,
    confidence: r.confidence,
    importance: r.importance,
    createdAt: r.created_at,
    score: Math.min(r.rank, 1), // normalize rank to 0-1 range
  }));
}

export async function condenseMemories(userMessage: string, memories: RetrievedMemory[]): Promise<string | null> {
  if (memories.length === 0) return null;

  const memorySummaries = memories.map((m) => `- ${m.summary}`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: {
        systemInstruction:
          'You are condensing retrieved memory facts for an AI executive assistant. Write a single short paragraph (≤80 words) of plain text with only the facts directly relevant to the request. No bullet points, no labels, no preamble. Plain prose only.',
        temperature: 0.1,
        maxOutputTokens: 150,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Owner's request: "${userMessage}"\n\nRelevant memory facts:\n${memorySummaries}\n\nCondense into a short paragraph of only what's relevant.`,
            },
          ],
        },
      ],
    });

    const packet = response.text?.trim();
    if (!packet) return null;

    // Mark all retrieved memories as accessed
    await Promise.allSettled(
      memories.map((m) =>
        db.memory.update({
          where: { id: m.id },
          data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
        }),
      ),
    );

    return packet;
  } catch (error) {
    logger.warn('[memory] Condensation failed', { error: error instanceof Error ? error.message : error });
    return null;
  }
}
