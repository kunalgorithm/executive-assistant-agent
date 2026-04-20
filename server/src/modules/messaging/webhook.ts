import type { Request, Response } from 'express';

import { sendReaction, sendAndSaveOutbound, sendTypingIndicator, sendMultipartOutbound } from './send';
import {
  mapSendblueStatus,
  cleanSendblueData,
  type SendblueInboundPayload,
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
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { pickReaction, generateSaylaResponse, getUserConversation } from './ai';
import { extractAndWriteMemories } from '@/modules/memory/extractor';

export async function handleInboundMessageWebhook(req: Request, res: Response) {
  const { data, errors } = getZodErrors(sendblueInboundWebhookSchema, req.body);
  if (!data || errors) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { webhook: 'Invalid webhook payload' } });
    return;
  }

  res.sendStatus(statusCodes.OK);

  // Single-owner lock: reject any number that isn't the configured owner.
  if (env.OWNER_PHONE_NUMBER && data.from_number !== env.OWNER_PHONE_NUMBER) {
    logger.warn('[webhook] Rejected inbound from non-owner number', { fromNumber: data.from_number });
    return;
  }

  runExclusive(data.from_number, async () => {
    try {
      await processInboundMessageAsync(data);
    } catch (error) {
      logger.error('[webhook] FATAL: message processing threw unhandled error', {
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return; // duplicate webhook
    throw error;
  }

  trackEvent(ANALYTICS_EVENTS.inbound_message_received, user?.id ?? undefined);

  if (!user) {
    // First message from the owner creates their user record.
    const timezone = timezoneFromPhone(data.from_number);
    user = await db.user.create({
      data: { timezone, lastMessageAt: new Date(), phoneNumber: data.from_number },
    });
    trackEvent(ANALYTICS_EVENTS.user_created_via_sms, user.id, { timezone, fromNumber: data.from_number });
  } else {
    await db.user.update({ where: { id: user.id }, data: { lastMessageAt: new Date() } });
  }

  if (!user.isActive) return;

  if (!data.content || data.content.trim().length === 0) return;

  // Tapback reactions arrive as normal inbound webhooks — ignore them.
  if (/^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned) "/.test(data.content.trim())) {
    logger.info('[process] Ignoring tapback reaction', { userId: user.id, content: data.content });
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

  await sendTypingIndicator(data.from_number);

  const aiResponse = await generateSaylaResponse(conversationHistory, user);
  if (!aiResponse) {
    trackEvent(ANALYTICS_EVENTS.ai_response_failed, user.id);
    await sendAndSaveOutbound(
      'sorry — something went sideways on my end. try again in a sec?',
      data.from_number,
      user.id,
    );
    return;
  }

  await sendMultipartOutbound(aiResponse, data.from_number, user.id);

  // Fire-and-forget: extract memories from this exchange without blocking the response
  extractAndWriteMemories(data.content, aiResponse, conversationHistory, user.id).catch((err) => {
    logger.warn('[memory] Background extraction failed', {
      userId: user!.id,
      error: err instanceof Error ? err.message : err,
    });
  });
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
