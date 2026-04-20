import type { Request, Response } from 'express';

import {
  sendReaction,
  sendAndSaveOutbound,
  sendTypingIndicator,
  sendMultipartOutbound,
  sendMultipartGroupOutbound,
} from './send';
import {
  MESSAGE_TYPES,
  SMS_TEMPLATES,
  USER_STATUSES,
  MATCH_STATUSES,
  SAYLA_COMMAND_PREFIX,
  type OnboardingSubstatus,
} from '@/utils/constants';
import {
  mapSendblueStatus,
  cleanSendblueData,
  type SendblueInboundPayload,
  sendblueInboundWebhookSchema,
  sendblueStatusCallbackSchema,
} from './helpers';
import {
  getUserConversation,
  getGroupConversation,
  generateSaylaGroupResponse,
  formatGroupConversationHistory,
} from '@/modules/messaging/ai';
import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { runExclusive } from '@/utils/locks';
import { Prisma } from '@/generated/prisma/client';
import { createSemaphore } from '@/utils/semaphore';
import { timezoneFromPhone } from '@/utils/timezone';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { generateAndStoreEmbedding } from '@/modules/matching/embeddings';
import { pickReaction, extractProfileData, generateSaylaResponse, classifyOptInResponse } from './ai';

// Limit concurrent heavy background work (AI extraction + embedding + matching)
const heavyWorkSemaphore = createSemaphore(3);

export async function handleInboundMessageWebhook(req: Request, res: Response) {
  const { data, errors } = getZodErrors(sendblueInboundWebhookSchema, req.body);
  if (!data || errors) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { webhook: 'Invalid webhook payload' } });
    return;
  }

  res.sendStatus(statusCodes.OK);

  const isGroupMessage = data.message_type === 'group' && data.group_id;
  const lockKey = isGroupMessage ? data.group_id : data.from_number;

  runExclusive(lockKey, async () => {
    try {
      if (isGroupMessage) await processGroupMessage(data);
      else await processInboundMessageAsync(data);
    } catch (error) {
      logger.error('[webhook] FATAL: message processing threw unhandled error', {
        isGroupMessage,
        fromNumber: data.from_number,
        messageHandle: data.message_handle,
        error: error instanceof Error ? error.message : error,
      });
    }
  });
}

async function processInboundMessageAsync(data: SendblueInboundPayload) {
  let user = await db.user.findUnique({ where: { phoneNumber: data.from_number } });

  try {
    await db.channelMessage.create({
      data: {
        fromUserId: user?.id ?? null,
        messageHandle: data.message_handle,
        content: data.content || null,
        mediaUrl: data.media_url || null,
        sendblueData: cleanSendblueData(data),
        sentAt: data.date_sent ? new Date(data.date_sent) : new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return; // duplicate webhook, already processed
    throw error;
  }

  trackEvent(ANALYTICS_EVENTS.inbound_message_received, user?.id ?? undefined);

  let isNewPhoneLink = false;

  if (!user) {
    // Auto-create user from inbound SMS and start onboarding
    const timezone = timezoneFromPhone(data.from_number);
    user = await db.user.create({
      data: {
        timezone,
        lastMessageAt: new Date(),
        phoneNumber: data.from_number,
        status: USER_STATUSES.onboarding.label,
        substatus: USER_STATUSES.onboarding.substates.collecting_background,
      },
    });

    isNewPhoneLink = true;
    trackEvent(ANALYTICS_EVENTS.user_created_via_sms, user.id, { timezone, fromNumber: data.from_number });
  }

  if (!isNewPhoneLink) {
    await db.user.update({
      where: { id: user.id },
      data: { lastMessageAt: new Date(), checkinCount: 0, lastCheckinAt: null },
    });
    logger.info('[process] Updated lastMessageAt and reset checkin counter', { userId: user.id });
  }

  // Reset command: wipe profile and restart onboarding (exact "NEW" or "RESET" only)
  if (data.content && /^(new|reset)$/i.test(data.content.trim())) {
    logger.info('[process] RESET command received, wiping user profile', { userId: user.id });

    await db.channelMessage.deleteMany({
      where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
    });

    await db.$executeRawUnsafe(
      `UPDATE "users" SET first_name = NULL, last_name = NULL, title = NULL, bio = NULL, tags = '{}', embedding = NULL,
       linkedin_url = NULL, twitter_url = NULL, instagram_url = NULL, website_url = NULL,
       status = $2, substatus = $3,
       checkin_count = 0, last_checkin_at = NULL WHERE id = $1`,
      user.id,
      USER_STATUSES.onboarding.label,
      USER_STATUSES.onboarding.substates.collecting_background,
    );

    logger.info('[process] User profile wiped', { userId: user.id });
    trackEvent(ANALYTICS_EVENTS.user_profile_reset, user.id);

    await sendAndSaveOutbound(SMS_TEMPLATES.WELCOME_INTRO, data.from_number, user.id); // Send the welcome sequence: new user
    await sendAndSaveOutbound(SMS_TEMPLATES.WELCOME_QUESTION, data.from_number, user.id);

    await sendAndSaveOutbound(
      'save my number btw 👆',
      data.from_number,
      user.id,
      SMS_TEMPLATES.WELCOME_CONTACT_CARD_URL,
    );

    trackEvent(ANALYTICS_EVENTS.user_reset, user.id);
    return;
  }

  // TCPA compliance: detect "stop" command and deactivate user immediately
  if (data.content && /^stop$/i.test(data.content.trim())) {
    logger.info('[process] STOP command received, deactivating user', { userId: user.id });

    await db.user.update({
      where: { id: user.id },
      data: { isActive: false, status: USER_STATUSES.inactive.label, substatus: null },
    });

    trackEvent(ANALYTICS_EVENTS.user_stopped, user.id);
    return;
  }

  if (!user.isActive) return; // ignore if user is inactive

  // New phone link: send welcome messages + contact card
  if (isNewPhoneLink) {
    await sendAndSaveOutbound(SMS_TEMPLATES.WELCOME_INTRO, data.from_number, user.id);
    await sendAndSaveOutbound(SMS_TEMPLATES.WELCOME_QUESTION, data.from_number, user.id);

    await sendAndSaveOutbound(
      'save my number btw 👆',
      data.from_number,
      user.id,
      SMS_TEMPLATES.WELCOME_CONTACT_CARD_URL,
    );

    return;
  }

  if (!data.content || data.content.trim().length === 0) return; // no text content to process for AI

  // Tapback reactions (e.g. 'Liked "message"') arrive as normal inbound webhooks.
  // Detect and ignore them so we don't generate a full AI response to a reaction.
  if (/^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned) "/.test(data.content.trim())) {
    logger.info('[process] Ignoring tapback reaction', { userId: user.id, content: data.content });
    return;
  }

  // Check for pending opt-in introduction — if handled, skip normal AI response
  logger.info('[process] Checking for pending opt-in match', { userId: user.id });
  let optInHandled = false;
  try {
    optInHandled = await checkOptInResponse(user.id, data.content, data.from_number);
  } catch (error) {
    logger.error('[webhook] Failed to check opt-in response', {
      userId: user.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  if (optInHandled) return; // skip the flow if this message was an opt in response

  // Maybe react to the message with a tapback (fire-and-forget)
  pickReaction(data.content)
    .then((reaction) => {
      if (reaction) sendReaction(data.message_handle, reaction);
    })
    .catch((err) => {
      logger.warn('[process] Failed to evaluate tapback reaction', {
        userId: user!.id,
        error: err instanceof Error ? err.message : err,
      });
    });

  const conversationHistory = await getUserConversation(user.id);

  await sendTypingIndicator(data.from_number); // send initial typing indicator while AI generates

  const aiResponse = await generateSaylaResponse(conversationHistory, user);
  if (!aiResponse) {
    trackEvent(ANALYTICS_EVENTS.ai_response_failed, user.id, { userName: user.firstName, substatus: user.substatus });
    return;
  }

  await sendMultipartOutbound(aiResponse, data.from_number, user.id);

  // Run onboarding extraction if applicable
  if (user.status === USER_STATUSES.onboarding.label) {
    heavyWorkSemaphore
      .acquire()
      .then(async (release) => {
        try {
          await processOnboardingExtraction(user.id, conversationHistory, user.substatus as OnboardingSubstatus | null);
        } finally {
          release();
        }
      })
      .catch((error) => {
        logger.error('[webhook] Failed to process onboarding extraction', {
          userId: user.id,
          error: error instanceof Error ? error.message : error,
        });
      });
  }
}

async function processGroupMessage(data: SendblueInboundPayload) {
  if (!data.content || data.content.trim().length === 0) return;
  const trimmedContent = data.content.trim();

  // Ignore tapback reactions in group
  if (/^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned) "/.test(trimmedContent)) return;

  const match = await db.match.findUnique({
    where: { groupId: data.group_id },
    select: { userA: true, userB: true, id: true, status: true },
  });
  if (!match) {
    logger.warn('[group] Received group message for unknown group', { groupId: data.group_id });
    return;
  }

  const users = [match.userA, match.userB];
  const senderUser = users.find((u) => u.phoneNumber === data.from_number);
  const otherUser = users.find((u) => u.phoneNumber !== data.from_number);
  if (!senderUser || !otherUser) {
    logger.warn('[group] Could not identify sender or recipient of group message', {
      groupId: data.group_id,
      fromNumber: data.from_number,
    });
    return;
  }

  // Store the group message
  try {
    await db.channelMessage.create({
      data: {
        fromUserId: senderUser.id,
        matchId: match.id,
        messageType: MESSAGE_TYPES.group,
        messageHandle: data.message_handle,
        content: data.content || null,
        mediaUrl: data.media_url || null,
        sendblueData: cleanSendblueData(data),
        sentAt: data.date_sent ? new Date(data.date_sent) : new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }

  // Only respond if message starts with /sayla
  if (!trimmedContent.toLowerCase().startsWith(SAYLA_COMMAND_PREFIX)) return;

  const userNames = new Map(users.map((u) => [u.id, u.firstName ?? 'Someone']));

  const rawHistory = await getGroupConversation(match.id);
  const conversationHistory = formatGroupConversationHistory(rawHistory, userNames);

  // If the user typed just "/sayla" with no message, add a nudge so Sayla has something to respond to
  const userMessage = trimmedContent.slice(SAYLA_COMMAND_PREFIX.length).trim();
  if (userMessage) {
    conversationHistory.push({ role: 'user', content: `[${senderUser.firstName ?? 'Someone'}]: ${userMessage}` });
  }

  const aiResponse = await generateSaylaGroupResponse(
    conversationHistory,
    senderUser?.firstName ?? null,
    otherUser?.firstName ?? null,
  );

  if (!aiResponse) {
    logger.warn('[group] AI failed to generate group response', { matchId: match.id, groupId: data.group_id });
    return;
  }

  await sendMultipartGroupOutbound(aiResponse, data.group_id, match.id);
}

const SOCIAL_LINK_FIELDS: Record<string, 'linkedinUrl' | 'twitterUrl' | 'instagramUrl' | 'websiteUrl'> = {
  linkedin: 'linkedinUrl',
  X: 'twitterUrl',
  twitter: 'twitterUrl',
  instagram: 'instagramUrl',
  website: 'websiteUrl',
};

async function sendSocialLink(otherUserId: string, platform: string, phoneNumber: string, requestingUserId: string) {
  const field = SOCIAL_LINK_FIELDS[platform];
  if (!field) return;

  const otherUser = await db.user.findUnique({
    where: { id: otherUserId },
    select: { firstName: true, linkedinUrl: true, twitterUrl: true, instagramUrl: true, websiteUrl: true },
  });
  if (!otherUser) return;

  const url = otherUser[field];
  const name = otherUser.firstName ?? 'them';

  if (url) {
    await sendAndSaveOutbound(`here's ${name}'s ${platform}: ${url}`, phoneNumber, requestingUserId);
  } else {
    await sendAndSaveOutbound(
      `hmm ${name} hasn't shared their ${platform} with me yet — i'll pass along the request!`,
      phoneNumber,
      requestingUserId,
    );
  }
}

/**
 * Check if this inbound message is a response to a pending opt-in intro.
 * Returns true if the message was handled (accepted or declined), false otherwise.
 */
async function checkOptInResponse(userId: string, messageContent: string, phoneNumber: string): Promise<boolean> {
  const match = await db.match.findFirst({
    where: { status: MATCH_STATUSES.awaiting_opt_in, OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      userAOptedIn: true,
      userBOptedIn: true,
      userADeclined: true,
      userBDeclined: true,
    },
  });

  if (!match) return false;

  const isUserA = match.userAId === userId;
  const alreadyOptedIn = isUserA ? match.userAOptedIn : match.userBOptedIn;
  const alreadyDeclined = isUserA ? match.userADeclined : match.userBDeclined;
  logger.info('[opt-in] Found pending match', { userId, matchId: match.id, isUserA, alreadyOptedIn, alreadyDeclined });

  if (alreadyOptedIn || alreadyDeclined) return false; // already responded, skip classification

  const { result: classification, linkRequest } = await classifyOptInResponse(messageContent);
  logger.info('[opt-in] Classification result', {
    userId,
    matchId: match.id,
    isUserA,
    classification,
    linkRequest,
    messageContent,
  });

  // Handle social link request — look up the other user's link and send it
  if (linkRequest) {
    const otherUserId = isUserA ? match.userBId : match.userAId;
    await sendSocialLink(otherUserId, linkRequest, phoneNumber, userId);
  }

  if (!classification) return !!linkRequest; // if we handled a link request, skip normal AI flow

  if (classification === 'accepted') {
    const otherOptedIn = isUserA ? match.userBOptedIn : match.userAOptedIn;
    const updateData: { userAOptedIn?: boolean; userBOptedIn?: boolean; status?: string } = isUserA
      ? { userAOptedIn: true }
      : { userBOptedIn: true };

    if (otherOptedIn) {
      updateData.status = MATCH_STATUSES.ready;
      trackEvent(ANALYTICS_EVENTS.match_ready, userId, { matchId: match.id, userId });
    }

    await db.match.update({ where: { id: match.id }, data: updateData });

    trackEvent(ANALYTICS_EVENTS.user_opted_in, userId, { matchId: match.id });

    // Send canned acceptance response
    await sendAndSaveOutbound(
      "great. i'll float your profile by them and if they're in, will go ahead and make the intro!",
      phoneNumber,
      userId,
    );

    return true;
  }

  if (classification === 'declined') {
    const updateData: { userADeclined?: boolean; userBDeclined?: boolean } = isUserA
      ? { userADeclined: true }
      : { userBDeclined: true };

    await db.match.update({ where: { id: match.id }, data: updateData });

    trackEvent(ANALYTICS_EVENTS.user_declined_intro, userId, { matchId: match.id });

    // Send canned decline response
    await sendAndSaveOutbound('no worries, ill keep looking for great people for you to meet!', phoneNumber, userId);
    return true;
  }

  return false;
}

async function processOnboardingExtraction(
  userId: string,
  conversationHistory: { role: 'user' | 'model'; content: string }[],
  currentSubstatus: OnboardingSubstatus | null,
) {
  if (!currentSubstatus) return;

  // If stuck in generating_embedding (previous attempt failed), retry embedding directly — skip extraction
  if (currentSubstatus === USER_STATUSES.onboarding.substates.generating_embedding) {
    await generateAndStoreEmbedding(userId);
    return;
  }

  const extraction = await extractProfileData(conversationHistory);
  if (!extraction) return; // extraction failed or didn't return any usable data, skip profile update

  const profileUpdate: Record<string, unknown> = {
    ...(extraction.firstName ? { firstName: extraction.firstName } : {}),
    ...(extraction.lastName ? { lastName: extraction.lastName } : {}),
    ...(extraction.title ? { title: extraction.title } : {}),
    ...(extraction.bio ? { bio: extraction.bio } : {}),
    ...(extraction.tags.length > 0 ? { tags: extraction.tags } : {}),
    ...(extraction.linkedinUrl ? { linkedinUrl: extraction.linkedinUrl } : {}),
    ...(extraction.twitterUrl ? { twitterUrl: extraction.twitterUrl } : {}),
    ...(extraction.instagramUrl ? { instagramUrl: extraction.instagramUrl } : {}),
    ...(extraction.websiteUrl ? { websiteUrl: extraction.websiteUrl } : {}),
    ...(extraction.primaryIntent ? { primaryIntent: extraction.primaryIntent } : {}),
  };

  let nextSubstatus: OnboardingSubstatus | null = currentSubstatus;

  if (
    currentSubstatus === USER_STATUSES.onboarding.substates.collecting_background &&
    extraction.hasEnoughForBackground
  ) {
    nextSubstatus = USER_STATUSES.onboarding.substates.collecting_interests;
  } else if (
    currentSubstatus === USER_STATUSES.onboarding.substates.collecting_interests &&
    extraction.hasEnoughForInterests
  ) {
    nextSubstatus = USER_STATUSES.onboarding.substates.collecting_socials;
  } else if (
    currentSubstatus === USER_STATUSES.onboarding.substates.collecting_socials &&
    extraction.hasSharedSocials
  ) {
    nextSubstatus = USER_STATUSES.onboarding.substates.generating_embedding;
  }

  if (nextSubstatus !== currentSubstatus) {
    profileUpdate.substatus = nextSubstatus;
    trackEvent(ANALYTICS_EVENTS.onboarding_substatus_changed, userId, { from: currentSubstatus, to: nextSubstatus });
  }

  trackEvent(ANALYTICS_EVENTS.profile_extraction_completed, userId, {
    extractedFields: Object.keys(profileUpdate),
    currentSubstatus,
    nextSubstatus,
  });

  if (Object.keys(profileUpdate).length > 0) {
    await db.user.update({ data: profileUpdate, where: { id: userId } });
  }

  if (nextSubstatus === USER_STATUSES.onboarding.substates.generating_embedding) {
    await generateAndStoreEmbedding(userId);
  }
}

export async function handleStatusCallbackWebhook(req: Request, res: Response) {
  const { data, errors } = getZodErrors(sendblueStatusCallbackSchema, req.body);
  if (!data || errors) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { webhook: 'Invalid status callback' } });
    return;
  }

  res.sendStatus(statusCodes.OK);

  try {
    const message = await db.channelMessage.findUnique({ where: { messageHandle: data.message_handle } });
    if (!message) return; // unknown message handler, ignore

    const newStatus = mapSendblueStatus(data.status);
    await db.channelMessage.update({
      where: { id: message.id },
      data: {
        sendblueData: cleanSendblueData({ ...(message.sendblueData as object), latestStatus: newStatus, ...data }),
      },
    });
  } catch (error) {
    logger.error('[webhook] Failed to process status callback', {
      messageHandle: data.message_handle,
      error: error instanceof Error ? error.message : error,
    });
  }
}
