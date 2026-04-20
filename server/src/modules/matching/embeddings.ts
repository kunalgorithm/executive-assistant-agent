import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { USER_STATUSES } from '@/utils/constants';
import { trackEvent, ANALYTICS_EVENTS } from '@/utils/analytics';
import { buildProfileContext, generateEmbedding } from '@/utils/embeddings';
import { findCandidatesForUser, createSuggestedMatches } from './algorithm';

export async function generateAndStoreEmbedding(userId: string, options?: { onError?: () => void }) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { title: true, bio: true, tags: true } });
  if (!user) return; // embedding not found

  const context = buildProfileContext(user);
  if (!context) return; // empty profile context, skip embedding generation

  try {
    const embedding = await generateEmbedding(context);
    const vectorStr = `[${embedding.join(',')}]`;

    await db.$executeRawUnsafe(
      `UPDATE "users" SET embedding = $1::vector, status = $3, substatus = NULL WHERE id = $2`,
      vectorStr,
      userId,
      USER_STATUSES.ready_to_match.label,
    );

    trackEvent(ANALYTICS_EVENTS.onboarding_complete, userId);

    // Auto-find matching candidates now that embedding is ready
    findCandidatesForUser(userId)
      .then((candidates) => {
        if (candidates.length > 0) {
          logger.info('[matching] Found candidates after onboarding', { userId, count: candidates.length });
          return createSuggestedMatches(userId, candidates);
        }
        return 0;
      })
      .then((created) => {
        if (created > 0) logger.info('[matching] Suggested matches created after onboarding', { userId, created });
      })
      .catch((err) => {
        if (options?.onError) options.onError();
        logger.error('[matching] Failed to run matching after onboarding', {
          userId,
          error: err instanceof Error ? err.message : err,
        });
      });
  } catch (error) {
    if (options?.onError) options.onError();
    logger.error('[webhook] Failed to generate/store embedding', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
