import cron from 'node-cron';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { isQuietHours } from '@/utils/timezone';
import { sendMultipartOutbound } from '@/modules/messaging/send';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { generateCheckinMessage, getUserConversation } from '@/modules/messaging/ai';
import { USER_STATUSES, CHECKIN_JITTER_HOURS, CHECKIN_CADENCE_BASE_DAYS } from '@/utils/constants';

function jitteredThresholdMs(baseDays: number): number {
  const baseMs = baseDays * 24 * 60 * 60 * 1000;
  const jitterMs = Math.random() * CHECKIN_JITTER_HOURS * 60 * 60 * 1000;
  return baseMs + jitterMs;
}

const CHECKIN_CANDIDATE_LIMIT = 200;
const CHECKIN_BATCH_SIZE = 50;
const MIN_CADENCE_DAYS = Math.min(...CHECKIN_CADENCE_BASE_DAYS);

async function sendCheckins() {
  const maxCheckins = CHECKIN_CADENCE_BASE_DAYS.length;
  const minCutoff = new Date(Date.now() - MIN_CADENCE_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.user.findMany({
    where: {
      isActive: true,
      phoneNumber: { not: null },
      checkinCount: { lt: maxCheckins },
      status: { not: USER_STATUSES.onboarding.label },
      OR: [{ lastCheckinAt: { lte: minCutoff } }, { lastCheckinAt: null, lastMessageAt: { lte: minCutoff } }],
    },
    take: CHECKIN_CANDIDATE_LIMIT,
    select: {
      id: true,
      firstName: true,
      phoneNumber: true,
      timezone: true,
      checkinCount: true,
      lastCheckinAt: true,
      lastMessageAt: true,
    },
  });

  if (candidates.length === 0) return;

  const now = Date.now();
  const eligibleUsers = candidates.filter((user) => {
    const lastActivity = user.lastCheckinAt ?? user.lastMessageAt;
    if (!lastActivity) return false;

    const elapsed = now - lastActivity.getTime();
    const baseDays = CHECKIN_CADENCE_BASE_DAYS[user.checkinCount];
    if (baseDays === undefined) return false;

    return elapsed >= jitteredThresholdMs(baseDays);
  });

  if (eligibleUsers.length === 0) return;

  // Shuffle so we don't always process users in the same order
  for (let i = eligibleUsers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = eligibleUsers[i]!;
    eligibleUsers[i] = eligibleUsers[j]!;
    eligibleUsers[j] = temp;
  }

  // Cap per cron tick — remaining users picked up next run
  const batch = eligibleUsers.slice(0, CHECKIN_BATCH_SIZE);

  logger.info(`Sending check-ins to ${batch.length} of ${eligibleUsers.length} eligible users`);

  for (const user of batch) {
    if (!user.phoneNumber) continue;

    if (isQuietHours(user.timezone)) continue; // skip during quiet hours in user's timezone

    try {
      const conversationHistory = await getUserConversation(user.id);

      const message = await generateCheckinMessage(conversationHistory, user.firstName);
      if (!message) continue; // failed to generate message, skip this user for now

      await sendMultipartOutbound(message, user.phoneNumber, user.id);

      await db.user.update({
        where: { id: user.id },
        data: { lastCheckinAt: new Date(), checkinCount: user.checkinCount + 1 },
      });

      trackEvent(ANALYTICS_EVENTS.checkin_sent, user.id, { checkinNumber: user.checkinCount + 1 });
    } catch (error) {
      logger.error('Failed to send check-in', {
        userId: user.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

export function startCheckinCron() {
  // Run every 4 hours — jitter on the threshold handles the randomness per-user
  cron.schedule('0 */4 * * *', () => {
    sendCheckins().catch((error) => {
      logger.error('Check-in cron failed', { error: error instanceof Error ? error.message : error });
    });
  });

  logger.info('Check-in cron job started (every 4 hours)');
}
