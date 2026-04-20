import { logger } from '@/utils/log';
import { classifyIntent, retrieveMemories, condenseMemories } from './retriever';

export async function getMemoryPacket(userId: string, userMessage: string): Promise<string | null> {
  const intent = classifyIntent(userMessage);
  if (intent === 'NONE') return null;

  try {
    const memories = await retrieveMemories(userId, userMessage);
    if (memories.length === 0) return null;

    return await condenseMemories(userMessage, memories);
  } catch (error) {
    logger.warn('[memory] Failed to build memory packet', {
      userId,
      intent,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
