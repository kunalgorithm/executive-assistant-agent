import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { sendblue } from '@/utils/sendblue';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { SMS_TEMPLATES, MATCH_STATUSES, MESSAGE_TYPES } from '@/utils/constants';

/**
 * Send the group intro via Sendblue for a ready match.
 * Called by the admin "Send Group Intro" button and by the notification cron.
 */
export async function sendGroupIntro(matchId: string, userAId: string, userBId: string) {
  const users = await db.user.findMany({
    where: { id: { in: [userAId, userBId] } },
    select: { id: true, firstName: true, title: true, phoneNumber: true },
  });
  if (users.length !== 2) return;

  const userA = users.find((u) => u.id === userAId);
  const userB = users.find((u) => u.id === userBId);

  if (!userA || !userB) return;
  if (!userA.phoneNumber || !userB.phoneNumber) return;

  const nameA = userA.firstName ?? 'Friend';
  const nameB = userB.firstName ?? 'Friend';
  const titleA = userA.title || 'Interesting person';
  const titleB = userB.title || 'Interesting person';

  const groupContent = SMS_TEMPLATES.GROUP_INTRO(nameA, titleA, nameB, titleB);

  logger.info('[outbound] Sending group intro via Sendblue', {
    matchId,
    numbers: [userA.phoneNumber, userB.phoneNumber],
    from_number: env.SENDBLUE_FROM_NUMBER,
  });

  const groupResult = await sendblue.groups.sendMessage({
    content: groupContent,
    from_number: env.SENDBLUE_FROM_NUMBER,
    numbers: [userA.phoneNumber, userB.phoneNumber],
  });

  logger.info('[outbound] Sendblue group response', { matchId, groupResult });

  const groupId = (groupResult as Record<string, unknown>).group_id as string | undefined;

  // Save the group intro as a ChannelMessage for admin visibility
  await db.channelMessage.create({
    data: {
      content: groupContent,
      matchId,
      messageType: MESSAGE_TYPES.group,
      sendblueData: groupResult as object,
      sentAt: new Date(),
    },
  });

  // Store group_id on the match
  await db.match.update({
    where: { id: matchId },
    data: { status: MATCH_STATUSES.notified, groupId: groupId ?? null },
  });

  logger.info('[outbound] Group introduction sent', { matchId, groupId });
  trackEvent(ANALYTICS_EVENTS.match_notified, undefined, { matchId, userAId, userBId, groupId });
}
