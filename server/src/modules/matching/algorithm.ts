import {
  USER_STATUSES,
  MATCH_STATUSES,
  PRIMARY_INTENTS,
  type PrimaryIntent,
  GEMINI_FLASH3_MODEL,
} from '@/utils/constants';
import { db } from '@/utils/db';
import { ai } from '@/utils/gemini';
import { logger } from '@/utils/log';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { userForMatchingSelect, type UserForMatching, type ScoredCandidate } from './helpers';

const INTENT_WEIGHT = 0.4;
const SIMILARITY_WEIGHT = 0.6;
const MIN_SCORE_THRESHOLD = 0.5;
const MAX_CANDIDATES_PER_USER = 5;
const VECTOR_SEARCH_LIMIT = 20;

function computeIntentScore(intentA: string | null, intentB: string | null): number {
  if (!intentA || !intentB) return 0;

  const configA = PRIMARY_INTENTS[intentA as PrimaryIntent];
  const configB = PRIMARY_INTENTS[intentB as PrimaryIntent];
  if (!configA || !configB) return 0;

  const aCompatible = (configA.compatibleWith as readonly string[]).includes(intentB);
  const bCompatible = (configB.compatibleWith as readonly string[]).includes(intentA);

  return aCompatible && bCompatible ? 1 : 0;
}

async function findNearestByEmbedding(userId: string, limit: number): Promise<{ id: string; distance: number }[]> {
  const rows = await db.$queryRawUnsafe<{ id: string; distance: number }[]>(
    `SELECT u.id, u.embedding <=> (SELECT embedding FROM users WHERE id = $1)::vector AS distance
     FROM users u
     WHERE u.status = $3
       AND u.id != $1
       AND u.embedding IS NOT NULL
     ORDER BY distance
     LIMIT $2`,
    userId,
    limit,
    USER_STATUSES.ready_to_match.label,
  );
  return rows;
}

async function getExistingMatchPairs(userId: string): Promise<Set<string>> {
  const matches = await db.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: { notIn: [MATCH_STATUSES.rejected, MATCH_STATUSES.expired, MATCH_STATUSES.reported] },
    },
    select: { userAId: true, userBId: true },
  });

  const paired = new Set<string>();
  for (const m of matches) {
    paired.add(m.userAId === userId ? m.userBId : m.userAId);
  }
  return paired;
}

export async function generateMatchReason(userA: UserForMatching, userB: UserForMatching): Promise<string | null> {
  const profileSummary = (u: UserForMatching) =>
    [
      u.title,
      u.bio,
      u.tags.length > 0 ? `interests: ${u.tags.join(', ')}` : null,
      u.primaryIntent ? `looking for: ${u.primaryIntent}` : null,
    ]
      .filter(Boolean)
      .join('. ');

  const nameA = [userA.firstName, userA.lastName].filter(Boolean).join(' ') || 'User A';
  const nameB = [userB.firstName, userB.lastName].filter(Boolean).join(' ') || 'User B';

  const prompt = `Write ONE sentence (max 40 words) explaining why these two people would be a great match. Use their first names. Be specific.

${nameA}: ${profileSummary(userA)}
${nameB}: ${profileSummary(userB)}

Rules:
- Exactly ONE complete sentence ending with a period
- Maximum 40 words
- Be very specific, concise and do not use flattery language
- No filler phrases like "ideal match because" or "can leverage"
- State the concrete connection directly`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: { temperature: 0.7, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let text = response.text?.trim() || null;
    if (!text) return null;

    // Safety net: if truncated, trim to last complete sentence or word
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      const lastEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
      if (lastEnd > 0) {
        text = text.slice(0, lastEnd + 1);
      } else {
        const lastSpace = text.lastIndexOf(' ');
        text = (lastSpace > 0 ? text.slice(0, lastSpace) : text) + '.';
      }
    }

    return text;
  } catch (error) {
    logger.error('[matching] Failed to generate match reason', {
      userAId: userA.id,
      userBId: userB.id,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function findCandidatesForUser(userId: string): Promise<ScoredCandidate[]> {
  const startMs = Date.now();

  const targetUser = await db.user.findUnique({ where: { id: userId }, select: userForMatchingSelect });
  if (!targetUser || targetUser.status !== USER_STATUSES.ready_to_match.label) return [];

  const [nearestRows, existingPairs] = await Promise.all([
    findNearestByEmbedding(userId, VECTOR_SEARCH_LIMIT),
    getExistingMatchPairs(userId),
  ]);

  const candidateIds = nearestRows.filter((r) => !existingPairs.has(r.id)).map((r) => r.id);
  if (candidateIds.length === 0) return [];

  const candidates = await db.user.findMany({ where: { id: { in: candidateIds } }, select: userForMatchingSelect });

  const scored: ScoredCandidate[] = [];
  const distanceMap = new Map(nearestRows.map((r) => [r.id, r.distance]));

  for (const candidate of candidates) {
    const intentScore = computeIntentScore(targetUser.primaryIntent, candidate.primaryIntent);
    if (intentScore === 0) continue; // hard filter: incompatible intents

    const distance = distanceMap.get(candidate.id) ?? 1;
    const similarityScore = Math.max(0, 1 - distance);
    const score = INTENT_WEIGHT * intentScore + SIMILARITY_WEIGHT * similarityScore;

    if (score >= MIN_SCORE_THRESHOLD) {
      scored.push({ user: candidate, score, intentScore, similarityScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_CANDIDATES_PER_USER);

  const elapsedMs = Date.now() - startMs;
  logger.info('[matching] Candidate search complete', {
    userId,
    nearestCount: nearestRows.length,
    afterFilter: candidateIds.length,
    afterIntent: scored.length,
    returned: top.length,
    elapsedMs,
  });

  return top;
}

export async function createSuggestedMatches(userId: string, candidates: ScoredCandidate[]): Promise<number> {
  const targetUser = await db.user.findUnique({ where: { id: userId }, select: userForMatchingSelect });
  if (!targetUser) return 0;

  let created = 0;

  for (const candidate of candidates) {
    // Create match first to check unique constraint before expensive Gemini call
    let matchId: string;
    try {
      const match = await db.match.create({
        data: {
          userAId: userId,
          userBId: candidate.user.id,
          status: MATCH_STATUSES.suggested,
          score: Math.round(candidate.score * 1000) / 1000,
          intentScore: candidate.intentScore,
          similarityScore: Math.round(candidate.similarityScore * 1000) / 1000,
        },
      });
      matchId = match.id;
      created++;
    } catch (error) {
      // Unique constraint violation — pair already exists, skip Gemini call
      logger.warn('[matching] Match already exists, skipping', {
        userAId: userId,
        userBId: candidate.user.id,
        error: error instanceof Error ? error.message : error,
      });
      continue;
    }

    // Generate reason after successful create — failure here is non-critical
    const matchReason = await generateMatchReason(targetUser, candidate.user);
    if (matchReason) {
      await db.match.update({ where: { id: matchId }, data: { matchReason } });
    }

    logger.info('[matching] Suggested match created', {
      userAId: userId,
      userBId: candidate.user.id,
      score: candidate.score,
      intentScore: candidate.intentScore,
      similarityScore: candidate.similarityScore,
    });
  }

  trackEvent(ANALYTICS_EVENTS.matches_suggested, undefined, { userId, created });
  return created;
}

const BATCH_MATCHING_CHUNK_SIZE = 50;

export async function runBatchMatching(): Promise<{ created: number }> {
  const startMs = Date.now();
  let totalCreated = 0;
  let totalProcessed = 0;
  let offset = 0;

  while (true) {
    const batch = await db.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM users WHERE status = $1 AND embedding IS NOT NULL ORDER BY id LIMIT $2 OFFSET $3`,
      USER_STATUSES.ready_to_match.label,
      BATCH_MATCHING_CHUNK_SIZE,
      offset,
    );

    if (batch.length === 0) break;

    for (const user of batch) {
      const candidates = await findCandidatesForUser(user.id);
      // Dedup handled by unique constraint on Match(userAId, userBId) — caught at create time
      if (candidates.length > 0) {
        const created = await createSuggestedMatches(user.id, candidates);
        totalCreated += created;
      }
    }

    totalProcessed += batch.length;
    if (batch.length < BATCH_MATCHING_CHUNK_SIZE) break;
    offset += batch.length;
  }

  const elapsedMs = Date.now() - startMs;
  logger.info('[matching] Batch matching complete', { totalCreated, usersProcessed: totalProcessed, elapsedMs });

  return { created: totalCreated };
}
