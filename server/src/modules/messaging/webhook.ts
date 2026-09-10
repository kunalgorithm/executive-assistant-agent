import type { Request, Response } from 'express';

import { sendReaction, sendAndSaveOutbound, sendTypingIndicator, sendMultipartOutbound } from './send';
import {
  mapSendblueStatus,
  cleanSendblueData,
  type SendblueInboundPayload,
  type SendblueStatusPayload,
  sendblueInboundWebhookSchema,
  sendblueStatusCallbackSchema,
} from './helpers';
import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { runExclusive } from '@/utils/locks';
import { Prisma } from '@/generated/prisma/client';
import { timezoneFromPhone } from '@/utils/timezone';
import { issueConnectLink } from '@/modules/google/oauth';
import { getConnectedAccountStatus } from '@/modules/integrations/accounts';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { pickReaction, generateSaylaResponse, getUserConversation } from './ai';
import { getOnboardingReply } from './connection-policy';

export async function handleInboundMessageWebhook(req: Request, res: Response) {
  const requestId = res.locals.webhookRequestId as string;
  const { data, errors } = getZodErrors(sendblueInboundWebhookSchema, req.body);
  if (!data || errors) {
    logger.warn('[webhook] Invalid inbound payload', { requestId, errors });
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { webhook: 'Invalid webhook payload' } });
    return;
  }

  acceptInboundMessage(data, res);
}

export function acceptInboundMessage(
  data: SendblueInboundPayload,
  res: Response,
  providerMetadata?: Prisma.InputJsonObject,
) {
  const requestId = res.locals.webhookRequestId as string;
  res.sendStatus(statusCodes.OK);

  const context = { requestId, messageHandle: data.message_handle, fromNumberLast4: data.from_number.slice(-4) };
  if (env.OWNER_PHONE_NUMBER && data.from_number !== env.OWNER_PHONE_NUMBER) {
    logger.warn('[webhook] Rejected inbound from non-owner number', {
      ...context,
      ownerNumberLast4: env.OWNER_PHONE_NUMBER.slice(-4),
    });
    return;
  }

  logger.info('[webhook] Inbound message accepted; queued for processing', {
    ...context,
    contentLength: data.content?.length ?? 0,
    hasMedia: !!data.media_url,
    service: data.service,
    isOutbound: data.is_outbound,
  });

  runExclusive(data.from_number, async () => {
    const startedAt = Date.now();
    logger.info('[webhook] Message processing started', context);
    try {
      await processInboundMessageAsync(data, requestId, providerMetadata);
      logger.info('[webhook] Message processing finished', { ...context, durationMs: Date.now() - startedAt });
    } catch (error) {
      logger.error('[webhook] FATAL: message processing threw unhandled error', {
        ...context,
        error: error instanceof Error ? error.message : error,
      });
    }
  });
}

async function processInboundMessageAsync(
  data: SendblueInboundPayload,
  requestId: string,
  providerMetadata?: Prisma.InputJsonObject,
) {
  const context = { requestId, messageHandle: data.message_handle };
  let user = await db.user.findUnique({ where: { phoneNumber: data.from_number } });

  try {
    await db.channelMessage.create({
      data: {
        fromUserId: user?.id ?? null,
        messageHandle: data.message_handle,
        content: data.content || null,
        mediaUrl: data.media_url || null,
        sendblueData: providerMetadata ?? cleanSendblueData(data),
        sentAt: data.date_sent ? new Date(data.date_sent) : new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('[webhook] Duplicate inbound message ignored', context);
      return;
    }
    throw error;
  }

  logger.info('[webhook] Inbound message saved', { ...context, userId: user?.id ?? null });
  trackEvent(ANALYTICS_EVENTS.inbound_message_received, user?.id ?? undefined);

  let isNewUser = false;
  if (!user) {
    const timezone = timezoneFromPhone(data.from_number);
    user = await db.user.create({
      data: { timezone, lastMessageAt: new Date(), phoneNumber: data.from_number },
    });
    // The first message was saved before the user existed. Include it in history
    // so a first-turn question or reminder reaches the AI instead of being lost.
    await db.channelMessage.update({
      where: { messageHandle: data.message_handle },
      data: { fromUserId: user.id },
    });
    isNewUser = true;
    trackEvent(ANALYTICS_EVENTS.user_created_via_sms, user.id, { timezone, fromNumber: data.from_number });
  } else {
    await db.user.update({ where: { id: user.id }, data: { lastMessageAt: new Date() } });
  }

  if (!user.isActive) {
    logger.info('[webhook] Inactive user; skipping response', { ...context, userId: user.id });
    return;
  }

  if (!data.content || data.content.trim().length === 0) {
    logger.info('[webhook] Empty message text; skipping response', { ...context, userId: user.id });
    return;
  }
  const trimmed = data.content.trim();

  // Tapback reactions arrive as normal inbound webhooks — ignore them.
  if (/^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned) "/.test(trimmed)) {
    logger.info('[webhook] Ignoring tapback reaction', { ...context, userId: user.id });
    return;
  }

  const onboardingReply = await getOnboardingReply({
    text: trimmed,
    isNewUser,
    issueLink: () => issueConnectLink(user.id),
  });
  if (onboardingReply) {
    await sendAndSaveOutbound(onboardingReply, data.from_number, user.id);
    return;
  }

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

  // Missing accounts limit the available tools, not access to the assistant.
  // Ordinary turns must not issue or rotate connection tokens.
  const accountStatus = await getConnectedAccountStatus(user.id);
  const calendarConnected = accountStatus.calendarConnected || user.calendarConnectedAt !== null;
  const contactsConnected = accountStatus.contactsConnected || user.contactsConnectedAt !== null;
  const tasksConnected = accountStatus.tasksConnected || user.tasksConnectedAt !== null;
  const gmailConnected = accountStatus.gmailConnected || user.gmailConnectedAt !== null;

  await sendTypingIndicator(data.from_number);

  logger.info('[webhook] Generating AI response', { ...context, userId: user.id });
  const aiResponse = await generateSaylaResponse(conversationHistory, user, {
    calendarConnected,
    contactsConnected,
    tasksConnected,
    gmailConnected,
    connectedAccounts: accountStatus.accounts,
    restaurantsAvailable: !!env.GOOGLE_MAPS_API_KEY,
  });
  if (!aiResponse) {
    logger.warn('[webhook] AI returned no response; sending fallback', { ...context, userId: user.id });
    trackEvent(ANALYTICS_EVENTS.ai_response_failed, user.id);
    await sendAndSaveOutbound(
      'sorry — something went sideways on my end. try again in a sec?',
      data.from_number,
      user.id,
    );
    return;
  }

  logger.info('[webhook] AI response ready; attempting reply delivery', {
    ...context,
    userId: user.id,
    responseLength: aiResponse.length,
  });
  await sendMultipartOutbound(aiResponse, data.from_number, user.id);
}

export async function handleStatusCallbackWebhook(req: Request, res: Response) {
  const { data, errors } = getZodErrors(sendblueStatusCallbackSchema, req.body);
  if (!data || errors) {
    logger.warn('[webhook] Invalid status callback payload', { requestId: res.locals.webhookRequestId, errors });
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { webhook: 'Invalid status callback' } });
    return;
  }

  await acceptStatusCallback(data, res);
}

export async function acceptStatusCallback(data: SendblueStatusPayload, res: Response) {
  res.sendStatus(statusCodes.OK);

  logger.info('[webhook] Delivery status received', {
    requestId: res.locals.webhookRequestId,
    messageHandle: data.message_handle,
    status: data.status,
    errorCode: data.error_code,
  });

  try {
    const message = await db.channelMessage.findUnique({ where: { messageHandle: data.message_handle } });
    if (!message) return;

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
