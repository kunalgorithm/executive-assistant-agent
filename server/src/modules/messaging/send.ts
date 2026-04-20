import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { sendblue } from '@/utils/sendblue';
import { MESSAGE_TYPES, WEBHOOK_STATUS_CALLBACK_URL } from '@/utils/constants';
import { cleanSendblueData, splitIntoTexts, typingDelayMs, type Reaction } from '@/modules/messaging/helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendTypingIndicator(toNumber: string) {
  try {
    const result = await sendblue.typingIndicators.send({ number: toNumber });
    if (result.status === 'ERROR') {
      throw new Error(`[ERROR] ${result.error_message || 'Unknown error from Sendblue API'}`);
    }
  } catch (error) {
    logger.warn('[typing] send status failed', { toNumber, error: error instanceof Error ? error.message : error });
  }
}

export async function sendAndSaveOutbound(content: string, toNumber: string, userId?: string, mediaUrl?: string) {
  const outbound = await db.channelMessage.create({
    data: { toUserId: userId ?? null, content, mediaUrl: mediaUrl ?? null },
  });

  try {
    const result = await sendblue.messages.send({
      content,
      number: toNumber,
      from_number: env.SENDBLUE_FROM_NUMBER,
      status_callback: WEBHOOK_STATUS_CALLBACK_URL,
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
    });

    await db.channelMessage.update({
      where: { id: outbound.id },
      data: { sentAt: new Date(), messageHandle: result.message_handle, sendblueData: cleanSendblueData(result) },
    });

    return outbound.id;
  } catch (error) {
    logger.error('[outbound] Failed to send message via Sendblue', {
      messageId: outbound.id,
      toNumber,
      userId: userId ?? 'unknown',
      contentLength: content.length,
      hasMediaUrl: !!mediaUrl,
      error: error instanceof Error ? error.message : error,
    });
    return outbound.id;
  }
}

/**
 * Send a long AI response as multiple short texts with human-like pacing.
 * Shows a typing indicator before each message, waits proportional to length, then sends.
 */
export async function sendMultipartOutbound(content: string, toNumber: string, userId?: string) {
  const chunks = splitIntoTexts(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const delay = typingDelayMs(chunk);

    await sendTypingIndicator(toNumber); // Show typing indicator before each message
    await sleep(delay); // Wait a human-like amount of time based on message length

    try {
      await sendAndSaveOutbound(chunk, toNumber, userId);
    } catch (error) {
      logger.error('[multipart] Failed to send chunk, continuing with remaining', {
        toNumber,
        chunkIndex: i,
        totalChunks: chunks.length,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  logger.info('[multipart] All chunks sent', { toNumber, userId: userId ?? 'unknown', chunkCount: chunks.length });
}

export async function sendGroupOutbound(content: string, groupId: string, matchId: string) {
  const outbound = await db.channelMessage.create({
    data: { content, matchId, messageType: MESSAGE_TYPES.group },
  });

  try {
    const result = await sendblue.groups.sendMessage({
      content,
      group_id: groupId,
      from_number: env.SENDBLUE_FROM_NUMBER,
    });

    await db.channelMessage.update({
      where: { id: outbound.id },
      data: { sentAt: new Date(), messageHandle: result.message_handle, sendblueData: cleanSendblueData(result) },
    });

    return outbound.id;
  } catch (error) {
    logger.error('[outbound] Failed to send group message via Sendblue', {
      messageId: outbound.id,
      groupId,
      matchId,
      error: error instanceof Error ? error.message : error,
    });
    return outbound.id;
  }
}

export async function sendMultipartGroupOutbound(content: string, groupId: string, matchId: string) {
  const chunks = splitIntoTexts(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const delay = typingDelayMs(chunk);
    await sleep(delay);

    try {
      await sendGroupOutbound(chunk, groupId, matchId);
    } catch (error) {
      logger.error('[multipart-group] Failed to send chunk, continuing with remaining', {
        groupId,
        chunkIndex: i,
        totalChunks: chunks.length,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  logger.info('[multipart-group] All chunks sent', { groupId, matchId, chunkCount: chunks.length });
}

/**
 * Send an iMessage tapback reaction (heart, laugh, emphasize, etc.) to a message.
 */
export async function sendReaction(messageHandle: string, reaction: Reaction) {
  try {
    await sendblue.post('/api/send-reaction', {
      body: { reaction, message_handle: messageHandle, from_number: env.SENDBLUE_FROM_NUMBER },
    });
  } catch (error) {
    logger.warn('[reaction] Failed to send tapback reaction', {
      reaction,
      messageHandle,
      error: error instanceof Error ? error.message : error,
    });
  }
}
