import cron from 'node-cron';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { withCronLock } from '@/utils/locks';
import { isQuietHours } from '@/utils/timezone';
import { MATCH_STATUSES } from '@/utils/constants';
import { sendGroupIntro } from '@/modules/matching/engine';

const NOTIFICATION_BATCH_SIZE = 50;

async function processReadyMatches() {
  // Find matches that are ready (both opted in) but not yet notified (no groupId)
  const readyMatches = await db.match.findMany({
    where: { groupId: null, status: MATCH_STATUSES.ready },
    take: NOTIFICATION_BATCH_SIZE,
    include: {
      userA: { select: { id: true, timezone: true } },
      userB: { select: { id: true, timezone: true } },
    },
  });

  if (readyMatches.length === 0) return;

  for (const match of readyMatches) {
    // Skip if either user is in quiet hours — cron will retry next tick
    if (isQuietHours(match.userA.timezone) || isQuietHours(match.userB.timezone)) continue;

    try {
      await sendGroupIntro(match.id, match.userAId, match.userBId);
      logger.info('[notifications] Group intro sent for ready match', { matchId: match.id });
    } catch (error) {
      logger.error('[notifications] Failed to send group intro', {
        matchId: match.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

export function startNotificationCron() {
  // Run every 15 minutes — sends group intros for ready matches outside quiet hours
  cron.schedule(
    '*/15 * * * *',
    withCronLock('notifications', processReadyMatches, {
      onError: (error) => {
        logger.error('[notifications] Notification cron failed', {
          error: error instanceof Error ? error.message : error,
        });
      },
    }),
  );

  logger.info('[notifications] Notification cron job started (every 15 minutes)');
}
