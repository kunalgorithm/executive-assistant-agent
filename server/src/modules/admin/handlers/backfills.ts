import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { MATCH_STATUSES, USER_STATUSES } from '@/utils/constants';
import { generateMatchReason } from '@/modules/matching/algorithm';
import { userForMatchingSelect } from '@/modules/matching/helpers';
import { generateAndStoreEmbedding } from '@/modules/matching/embeddings';
import { extractProfileData, getUserConversation } from '@/modules/messaging/ai';

const BACKFILL_PAGE_SIZE = 50;

export async function handleBackfillPrimaryIntent(req: Request, res: Response) {
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    const users = await db.user.findMany({
      where: { primaryIntent: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: BACKFILL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (users.length === 0) break;

    for (const user of users) {
      try {
        const history = await getUserConversation(user.id);
        if (history.length === 0) {
          skipped++;
          continue;
        }

        const extraction = await extractProfileData(history);
        if (!extraction?.primaryIntent) {
          skipped++;
          continue;
        }

        await db.user.update({
          where: { id: user.id },
          data: { primaryIntent: extraction.primaryIntent },
        });
        updated++;
      } catch (err) {
        logger.warn('[backfill] Failed to extract primaryIntent for user', {
          userId: user.id,
          error: err instanceof Error ? err.message : err,
        });
        skipped++;
      }
    }

    cursor = users[users.length - 1]!.id;
    if (users.length < BACKFILL_PAGE_SIZE) break;
  }

  logger.info('[backfill] Primary intent backfill complete', { updated, skipped });
  res.status(statusCodes.OK).json({ data: { updated, skipped }, errors: null });
}

export async function handleBackfillProfileCompletion(req: Request, res: Response) {
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    // find all users whose data is ready, but are still in onboarding status
    const users = await db.user.findMany({
      take: BACKFILL_PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true },
      where: {
        status: USER_STATUSES.onboarding.label,
        firstName: { not: null },
        primaryIntent: { not: null },
        title: { not: null },
        bio: { not: null },
        tags: { isEmpty: false },
        OR: [
          { linkedinUrl: { not: null } },
          { twitterUrl: { not: null } },
          { instagramUrl: { not: null } },
          { websiteUrl: { not: null } },
        ],
      },
    });
    if (users.length === 0) break;

    for (const user of users) {
      await generateAndStoreEmbedding(user.id, {
        onError: () => {
          skipped++;
        },
      }); // update the user with new embeddings
      updated++;
    }

    cursor = users[users.length - 1]!.id;
    if (users.length < BACKFILL_PAGE_SIZE) break;
  }

  logger.info('[backfill] Profile completion backfill complete', { updated, skipped });
  res.status(statusCodes.OK).json({ data: { updated, skipped }, errors: null });
}

export async function handleBackfillMatchReasons(_req: Request, res: Response) {
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;

  while (true) {
    const matches = await db.match.findMany({
      where: { status: MATCH_STATUSES.suggested },
      select: { id: true, userAId: true, userBId: true },
      orderBy: { createdAt: 'asc' },
      take: BACKFILL_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (matches.length === 0) break;

    for (const match of matches) {
      try {
        const [userA, userB] = await Promise.all([
          db.user.findUnique({ where: { id: match.userAId }, select: userForMatchingSelect }),
          db.user.findUnique({ where: { id: match.userBId }, select: userForMatchingSelect }),
        ]);

        if (!userA || !userB) {
          skipped++;
          continue;
        }

        const reason = await generateMatchReason(userA, userB);
        if (!reason) {
          skipped++;
          continue;
        }

        await db.match.update({
          where: { id: match.id },
          data: { matchReason: reason },
        });
        updated++;
      } catch (err) {
        logger.warn('[backfill] Failed to regenerate match reason', {
          matchId: match.id,
          error: err instanceof Error ? err.message : err,
        });
        skipped++;
      }
    }

    cursor = matches[matches.length - 1]!.id;
    if (matches.length < BACKFILL_PAGE_SIZE) break;
  }

  logger.info('[backfill] Match reasons backfill complete', { updated, skipped });
  res.status(statusCodes.OK).json({ data: { updated, skipped }, errors: null });
}
