import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { getLinqClient } from '@/utils/linq';
import { getSendblueClient } from '@/utils/sendblue';
import { WEBHOOK_STATUS_CALLBACK_URL } from '@/utils/constants';
import { cleanSendblueData, type Reaction } from './helpers';

// Reuse the existing JSON column for transport metadata; no database migration needed.
async function findLinqChat(toNumber: string): Promise<string | null> {
  const message = await db.channelMessage.findFirst({
    where: {
      AND: [
        { sendblueData: { path: ['provider'], equals: 'linq' } },
        { sendblueData: { path: ['lineNumber'], equals: env.LINQ_FROM_NUMBER } },
        { sendblueData: { path: ['peerNumber'], equals: toNumber } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { sendblueData: true },
  });
  const metadata = message?.sendblueData;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return typeof metadata.chatId === 'string' ? metadata.chatId : null;
}

export async function sendProviderMessage(content: string, toNumber: string, messageId: number, mediaUrl?: string) {
  if (env.MESSAGING_PROVIDER === 'linq') {
    const chatId = await findLinqChat(toNumber);
    if (!chatId) throw new Error('No Linq conversation found. The recipient must text the Linq number first.');
    const result = await getLinqClient().chats.messages.send(chatId, {
      message: {
        idempotency_key: `sayla-outbound-${messageId}`,
        parts: [{ type: 'text', value: content }, ...(mediaUrl ? [{ type: 'media' as const, url: mediaUrl }] : [])],
      },
    });
    return {
      messageHandle: `linq:${result.message.id}`,
      metadata: {
        provider: 'linq',
        chatId,
        lineNumber: env.LINQ_FROM_NUMBER,
        peerNumber: toNumber,
        latestStatus: 'queued',
      },
    };
  }

  const result = await getSendblueClient().messages.send({
    content,
    number: toNumber,
    from_number: env.SENDBLUE_FROM_NUMBER,
    status_callback: WEBHOOK_STATUS_CALLBACK_URL,
    ...(mediaUrl ? { media_url: mediaUrl } : {}),
  });
  if (result.status === 'ERROR') throw new Error('SendBlue rejected the outbound message');
  return { messageHandle: result.message_handle, metadata: cleanSendblueData(result) };
}

export async function sendProviderTyping(toNumber: string) {
  if (env.MESSAGING_PROVIDER === 'linq') {
    const chatId = await findLinqChat(toNumber);
    if (chatId) await getLinqClient().chats.typing.start(chatId);
    return;
  }
  const result = await getSendblueClient().typingIndicators.send({ number: toNumber });
  if (result.status === 'ERROR') throw new Error('SendBlue rejected the typing indicator');
}

export async function sendProviderReaction(messageHandle: string, reaction: Reaction) {
  if (reaction === 'none') return;
  if (env.MESSAGING_PROVIDER === 'linq') {
    if (!messageHandle.startsWith('linq:')) throw new Error('Cannot react to a message from a different provider');
    await getLinqClient().messages.addReaction(messageHandle.slice(5), { type: reaction, operation: 'add' });
    return;
  }
  await getSendblueClient().post('/api/send-reaction', {
    body: { reaction, message_handle: messageHandle, from_number: env.SENDBLUE_FROM_NUMBER },
  });
}
