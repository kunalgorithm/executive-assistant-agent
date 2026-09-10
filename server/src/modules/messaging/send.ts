import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { splitIntoTexts, typingDelayMs, type Reaction } from '@/modules/messaging/helpers';
import { sendProviderMessage, sendProviderReaction, sendProviderTyping } from './transport';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendTypingIndicator(toNumber: string) {
  try {
    await sendProviderTyping(toNumber);
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
    const result = await sendProviderMessage(content, toNumber, outbound.id, mediaUrl);

    await db.channelMessage.update({
      where: { id: outbound.id },
      data: { sentAt: new Date(), messageHandle: result.messageHandle, sendblueData: result.metadata },
    });

    logger.info('[outbound] Provider accepted message', {
      provider: env.MESSAGING_PROVIDER,
      messageId: outbound.id,
      messageHandle: result.messageHandle,
    });

    return outbound.id;
  } catch (error) {
    logger.error('[outbound] Failed to send message', {
      provider: env.MESSAGING_PROVIDER,
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
      await sendAndSaveOutbound(chunk, toNumber, userId, undefined, { throwOnError: true });
    } catch (error) {
      logger.error('[multipart] Failed to send chunk; stopping reply', {
        toNumber,
        chunkIndex: i,
        totalChunks: chunks.length,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  logger.info('[multipart] All chunks submitted', {
    provider: env.MESSAGING_PROVIDER,
    toNumber,
    userId: userId ?? 'unknown',
    chunkCount: chunks.length,
  });
}

export async function sendReaction(messageHandle: string, reaction: Reaction) {
  try {
    await sendProviderReaction(messageHandle, reaction);
  } catch (error) {
    logger.warn('[reaction] Failed to send tapback reaction', {
      reaction,
      messageHandle,
      error: error instanceof Error ? error.message : error,
    });
  }
}
