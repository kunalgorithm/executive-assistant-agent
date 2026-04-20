import { z } from 'zod';

import { ai } from '@/utils/gemini';
import { logger } from '@/utils/log';
import { safeJsonParse } from '@/utils/json';
import { writeMemory, type MemoryCandidate } from './service';
import { GEMINI_FLASH3_MODEL } from '@/utils/constants';
import type { ConversationMessage } from '@/modules/messaging/ai';

const WRITE_CONFIDENCE_THRESHOLD = 0.75;
const WRITE_IMPORTANCE_THRESHOLD = 0.5;
const EPISODIC_TTL_DAYS = 14;

const memoryCandidateSchema = z.object({
  content: z.string(),
  summary: z.string(),
  memoryType: z.enum(['SCHEDULING', 'PEOPLE', 'COMMUNICATION', 'WORK_CONTEXT']),
  category: z.enum(['SEMANTIC', 'EPISODIC']),
  source: z.enum(['USER_EXPLICIT', 'USER_INFERRED', 'ACTION_LOG', 'SYSTEM']),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  shouldWrite: z.boolean(),
  entities: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

const extractionResponseSchema = z.object({
  candidates: z.array(memoryCandidateSchema),
});

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extractor for an AI executive assistant. Your job is to identify facts worth remembering across sessions from a conversation turn.

Extract memory candidates only when one of these is true:
- The owner explicitly states a preference ("I don't do calls before 9", "always add a buffer")
- The owner corrects the assistant's proposal ("actually 45 minutes", "not on Tuesdays")
- The owner adds context about a person ("she's our legal counsel", "he's the CEO")
- An open loop is created that spans sessions ("I'll decide by Friday", "follow up next week")
- The owner reveals a communication rule ("always reply same-day to investors")

Do NOT extract:
- Routine calendar lookups or summaries
- Greetings, acknowledgements, or transient niceties
- Facts already obvious from public calendar/contact data
- One-off questions with no lasting relevance

Memory types:
- SCHEDULING: time preferences, buffer rules, meeting duration preferences, do-not-schedule windows
- PEOPLE: VIP status, relationship context, per-person communication style or history
- COMMUNICATION: email reply rules, priority senders, triage preferences, reply tone
- WORK_CONTEXT: active projects, open loops, ongoing threads, unresolved follow-ups

Categories:
- SEMANTIC: stable, long-lived facts (preferences, relationships, rules) — no expiry
- EPISODIC: time-bounded context (open loops, pending decisions, active threads) — expires in ${EPISODIC_TTL_DAYS} days

Sources:
- USER_EXPLICIT: owner stated it directly
- USER_INFERRED: inferred from a correction or behavioral pattern

For each candidate, write:
- content: the full fact with context
- summary: a concise version (≤20 words) for prompt injection
- confidence: 0-1 (how certain are you this is a stable, accurate fact)
- importance: 0-1 (how much will this help in future sessions)
- shouldWrite: true only if confidence ≥ 0.75 AND importance ≥ 0.50

Respond with valid JSON only.`;

export async function extractAndWriteMemories(
  userMessage: string,
  assistantResponse: string,
  recentHistory: ConversationMessage[],
  userId: string,
): Promise<void> {
  const recentContext = recentHistory
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Owner' : 'Sayla'}: ${m.content}`)
    .join('\n');

  const prompt = `Recent conversation context:
${recentContext}

Latest exchange:
Owner: ${userMessage}
Sayla: ${assistantResponse}

Extract memory candidates from this exchange.`;

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: {
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    rawResponse = response.text?.trim();
    const json = safeJsonParse(rawResponse);
    if (!json) return;

    const parsed = extractionResponseSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn('[memory] Extraction response failed schema validation', { userId });
      return;
    }

    const writeable = parsed.data.candidates.filter(
      (c) => c.shouldWrite && c.confidence >= WRITE_CONFIDENCE_THRESHOLD && c.importance >= WRITE_IMPORTANCE_THRESHOLD,
    );

    for (const candidate of writeable) {
      const memoryCandidate: MemoryCandidate = {
        content: candidate.content,
        summary: candidate.summary,
        memoryType: candidate.memoryType,
        category: candidate.category,
        source: candidate.source,
        confidence: candidate.confidence,
        importance: candidate.importance,
        entities: candidate.entities,
        expiresAt:
          candidate.category === 'EPISODIC'
            ? new Date(Date.now() + EPISODIC_TTL_DAYS * 24 * 60 * 60 * 1000)
            : undefined,
      };

      await writeMemory(userId, memoryCandidate);
    }
  } catch (error) {
    logger.warn('[memory] Extraction failed', {
      userId,
      rawResponse,
      error: error instanceof Error ? error.message : error,
    });
  }
}
