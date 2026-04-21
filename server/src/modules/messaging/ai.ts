import type { Content, Part } from '@google/genai';

import { ai } from '@/utils/gemini';

import { SAYLA_SYSTEM_PROMPT, buildConnectionStatusBlock, buildEnvironmentBlock } from './prompts';
import { pickReactionSchema } from './helpers';
import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { safeJsonParse } from '@/utils/json';
import type { UserModel } from '@/generated/prisma/models/User';
import { GEMINI_FLASH3_MODEL } from '@/utils/constants';
import {
  calendarFunctionDeclarations,
  contactsFunctionDeclarations,
  CALENDAR_TOOL_NAMES,
  dispatchCalendarToolCall,
  dispatchContactsToolCall,
} from '@/modules/google/tools';

export type ConversationMessage = { role: 'user' | 'model'; content: string };

function formatConversationHistory(
  messages: Array<{ fromUserId: string | null; content: string | null }>,
  userId: string,
): ConversationMessage[] {
  return messages
    .filter((msg) => msg.content)
    .map<ConversationMessage>((msg) => ({
      role: (msg.fromUserId === userId ? 'user' : 'model') as 'user' | 'model',
      content: msg.content!,
    }));
}

const CONVERSATION_HISTORY_LIMIT = 20;
export async function getUserConversation(userId: string) {
  const messages = await db.channelMessage.findMany({
    where: {
      sentAt: { not: null },
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: CONVERSATION_HISTORY_LIMIT,
    select: { fromUserId: true, content: true },
  });

  return formatConversationHistory(messages.reverse(), userId);
}

export type ConnectionState = {
  calendarConnected: boolean;
  contactsConnected: boolean;
  connectLink: string | null;
};

// Cap the number of model↔tool round-trips per user turn so a buggy loop can't run unbounded.
const MAX_TOOL_ROUND_TRIPS = 6;

export async function generateSaylaResponse(
  conversationHistory: ConversationMessage[],
  user: UserModel,
  connection: ConnectionState,
): Promise<string | null> {
  let systemInstruction = SAYLA_SYSTEM_PROMPT;

  if (user.firstName) {
    systemInstruction += `\n\n## Current User\nYou are assisting "${user.firstName}". Reference their name occasionally when it feels natural.`;
  }

  systemInstruction += buildEnvironmentBlock({ timezone: user.timezone });
  systemInstruction += buildConnectionStatusBlock(connection);

  const contents: Content[] = conversationHistory.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  // Assemble tool declarations based on what's connected.
  const functionDeclarations = [
    ...(connection.calendarConnected ? calendarFunctionDeclarations : []),
    ...(connection.contactsConnected ? contactsFunctionDeclarations : []),
  ];
  const tools = functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;

  let rawResponse: string | undefined;

  try {
    for (let i = 0; i < MAX_TOOL_ROUND_TRIPS; i++) {
      const response = await ai.models.generateContent({
        model: GEMINI_FLASH3_MODEL,
        config: {
          systemInstruction,
          tools,
          maxOutputTokens: 2000,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
        contents,
      });

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const modelParts = candidate?.content?.parts ?? [];

      // Collect any function calls the model wants to make in this turn.
      const functionCalls = modelParts.filter((p) => p.functionCall).map((p) => p.functionCall!);

      if (functionCalls.length === 0) {
        rawResponse = response.text?.trim();

        if (finishReason === 'MAX_TOKENS') {
          logger.warn('[ai] Response truncated (MAX_TOKENS)', {
            userId: user.id,
            responseLength: rawResponse?.length,
          });
        }

        if (!rawResponse) return null;

        if (finishReason === 'MAX_TOKENS') {
          const lastSentenceEnd = Math.max(
            rawResponse.lastIndexOf('. '),
            rawResponse.lastIndexOf('! '),
            rawResponse.lastIndexOf('? '),
            rawResponse.lastIndexOf('.'),
            rawResponse.lastIndexOf('!'),
            rawResponse.lastIndexOf('?'),
          );
          if (lastSentenceEnd > rawResponse.length * 0.5) {
            rawResponse = rawResponse.slice(0, lastSentenceEnd + 1);
          }
        }

        return rawResponse;
      }

      // Push the model's turn back verbatim (preserving thoughtSignature on functionCall parts —
      // Gemini 3 requires this when replaying tool calls in history).
      contents.push({ role: 'model', parts: modelParts });

      const responseParts: Part[] = [];
      for (const fc of functionCalls) {
        const dispatch = CALENDAR_TOOL_NAMES.has(fc.name!) ? dispatchCalendarToolCall : dispatchContactsToolCall;
        const result = await dispatch(user.id, fc.name!, (fc.args ?? {}) as Record<string, unknown>);
        logger.info('[ai] Tool call executed', { userId: user.id, name: fc.name, ok: result.ok });
        responseParts.push({
          functionResponse: { name: fc.name!, response: result },
        });
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    logger.warn('[ai] Hit MAX_TOOL_ROUND_TRIPS without producing text', { userId: user.id });
    return null;
  } catch (error) {
    logger.error('[ai] Failed to generate response', {
      rawResponse,
      userId: user.id,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

/**
 * Decide whether to react to an inbound message with a tapback.
 * Skips most messages — only reacts when something genuinely warrants it.
 */
export async function pickReaction(messageContent: string) {
  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'Should this message get a tapback reaction?' }] },
        { role: 'user', parts: [{ text: messageContent }] },
      ],
      model: GEMINI_FLASH3_MODEL,
      config: {
        systemInstruction:
          'You are an executive assistant texting over iMessage. You RARELY react to messages — only when something genuinely stands out (exciting news, a thank you, etc.). Most messages should get NO reaction. Always respond with valid JSON.',
        temperature: 0.3,
        maxOutputTokens: 100,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseJsonSchema: pickReactionSchema.toJSONSchema(),
      },
    });

    rawResponse = response.text?.trim();

    const json = safeJsonParse(rawResponse);
    if (!json) return null;

    const parsed = pickReactionSchema.parse(json);
    return parsed.reaction === 'none' ? null : parsed.reaction;
  } catch (error) {
    logger.warn('[reaction] Failed to pick reaction', {
      rawResponse,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
