import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { sendblue } from '@/utils/sendblue';
import { WEBHOOK_STATUS_CALLBACK_URL } from '@/utils/constants';
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

type SendAndSaveOptions = {
  throwOnError?: boolean;
};

export async function sendAndSaveOutbound(
  content: string,
  toNumber: string,
  userId?: string,
  mediaUrl?: string,
  options?: SendAndSaveOptions,
) {
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
    if (options?.throwOnError) throw error;
    return outbound.id;
  }
}

/**
 * Send a long AI response as multiple short texts with human-like pacing.
 */
export async function sendMultipartOutbound(content: string, toNumber: string, userId?: string) {
  const chunks = splitIntoTexts(content);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const delay = typingDelayMs(chunk);

    await sendTypingIndicator(toNumber);
    await sleep(delay);

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
