import { ai } from '@/utils/gemini';

import {
  CHECKIN_PROMPT,
  SUBSTATUS_PROMPTS,
  EXTRACTION_PROMPT,
  INTRO_DRAFT_PROMPT,
  SAYLA_GROUP_PROMPT,
  SAYLA_SYSTEM_PROMPT,
} from './prompts';
import {
  pickReactionSchema,
  type ProfileExtraction,
  profileExtractionSchema,
  classifyCheckInResponseSchema,
  type OptInClassificationResult,
} from './helpers';
import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { safeJsonParse } from '@/utils/json';
import type { UserModel } from '@/generated/prisma/models/User';
import { GEMINI_FLASH3_MODEL, MESSAGE_TYPES } from '@/utils/constants';

export type ConversationMessage = { role: 'user' | 'model'; content: string };
function formatConversationHistory(
  messages: Array<{ fromUserId: string | null; content: string | null }>,
  userId: string,
) {
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
      messageType: MESSAGE_TYPES.direct,
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: CONVERSATION_HISTORY_LIMIT,
    select: { fromUserId: true, content: true },
  });

  return formatConversationHistory(messages.reverse(), userId);
}

const GROUP_CONVERSATION_HISTORY_LIMIT = 30;

export async function getGroupConversation(matchId: string) {
  const messages = await db.channelMessage.findMany({
    where: { matchId, messageType: MESSAGE_TYPES.group, sentAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: GROUP_CONVERSATION_HISTORY_LIMIT,
    select: { fromUserId: true, content: true },
  });

  return messages.reverse();
}

export function formatGroupConversationHistory(
  messages: Array<{ fromUserId: string | null; content: string | null }>,
  userNames: Map<string, string>,
): ConversationMessage[] {
  return messages
    .filter((msg) => msg.content)
    .map<ConversationMessage>((msg) => {
      if (!msg.fromUserId) {
        return { role: 'model', content: msg.content! };
      }
      const name = userNames.get(msg.fromUserId) ?? 'Someone';
      return { role: 'user', content: `[${name}]: ${msg.content!}` };
    });
}

export async function generateSaylaGroupResponse(
  conversationHistory: ConversationMessage[],
  requestingUserName: string | null,
  otherUserName: string | null,
): Promise<string | null> {
  let systemInstruction = SAYLA_SYSTEM_PROMPT + SAYLA_GROUP_PROMPT;

  const names = [requestingUserName, otherUserName].filter(Boolean);
  if (names.length > 0) {
    systemInstruction += `\n\n## People in This Group\n${names.join(' and ')} are in this group chat with you.`;
  }

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: { systemInstruction, maxOutputTokens: 2000, temperature: 0.9 },
      contents: conversationHistory.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] })),
    });

    rawResponse = response.text?.trim();
    if (!rawResponse) return null;

    return rawResponse;
  } catch (error) {
    logger.error('[ai] Failed to generate Sayla group response', {
      rawResponse,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

function buildKnownProfileSection(user: UserModel): string {
  const lines: string[] = [];

  if (user.firstName) lines.push(`- Name: ${[user.firstName, user.lastName].filter(Boolean).join(' ')}`);
  if (user.primaryIntent) lines.push(`- Looking for: ${user.primaryIntent}`);
  if (user.title) lines.push(`- Title/role: ${user.title}`);
  if (user.bio) lines.push(`- Bio: ${user.bio}`);
  if (user.tags.length > 0) lines.push(`- Interests/skills: ${user.tags.join(', ')}`);
  if (user.linkedinUrl) lines.push(`- LinkedIn: ${user.linkedinUrl}`);
  if (user.twitterUrl) lines.push(`- Twitter/X: ${user.twitterUrl}`);
  if (user.instagramUrl) lines.push(`- Instagram: ${user.instagramUrl}`);
  if (user.websiteUrl) lines.push(`- Website: ${user.websiteUrl}`);

  if (lines.length === 0) return '';

  return `\n\n## What You Already Know About This Person (from their profile)\nThis data is already saved. Do NOT ask for any of these again. Only ask for information that is still missing.\n${lines.join('\n')}`;
}

export async function generateSaylaResponse(
  conversationHistory: ConversationMessage[],
  user: UserModel,
): Promise<string | null> {
  let systemInstruction = SAYLA_SYSTEM_PROMPT;

  if (user.firstName) {
    systemInstruction += `\n\n## Current User\nThe person you are chatting with is named "${user.firstName}". Reference their name occasionally and naturally, as a friend would.`;
  }

  systemInstruction += buildKnownProfileSection(user);

  if (user.substatus && user.substatus in SUBSTATUS_PROMPTS) {
    systemInstruction += `\n\n${SUBSTATUS_PROMPTS[user.substatus]}`;
  }

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH3_MODEL,
      config: { systemInstruction, maxOutputTokens: 2000, temperature: 0.9 },
      contents: conversationHistory.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] })),
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    rawResponse = response.text?.trim();

    if (finishReason === 'MAX_TOKENS') {
      logger.warn('[ai] Response was truncated (hit maxOutputTokens)', {
        finishReason,
        userId: user.id,
        substatus: user.substatus,
        responseLength: rawResponse?.length,
        responsePreview: rawResponse?.slice(-80),
      });
    }

    if (!rawResponse) return null; // empty response, treat as no reply

    // If the response was cut off mid-sentence, trim to the last complete sentence
    if (finishReason === 'MAX_TOKENS' && rawResponse) {
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
  } catch (error) {
    logger.error('[ai] Failed to generate Sayla response', {
      rawResponse,
      userId: user.id,
      substatus: user.substatus,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function extractProfileData(
  conversationHistory: ConversationMessage[],
): Promise<ProfileExtraction | null> {
  const contents = conversationHistory.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] }));
  contents.push({ role: 'user', parts: [{ text: EXTRACTION_PROMPT }] });

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      contents,
      model: GEMINI_FLASH3_MODEL,
      config: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
        responseJsonSchema: profileExtractionSchema.toJSONSchema(),
      },
    });

    rawResponse = response.text?.trim();

    const json = safeJsonParse(rawResponse);
    if (!json) return null;

    return profileExtractionSchema.parse(json);
  } catch (error) {
    logger.error('[ai-extraction] Failed to extract profile data', {
      rawResponse,
      historyLength: conversationHistory.length,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function generateCheckinMessage(
  conversationHistory: ConversationMessage[],
  userName?: string | null,
): Promise<string | null> {
  let systemInstruction = SAYLA_SYSTEM_PROMPT;

  if (userName) {
    systemInstruction += `\n\n## Current User\nThe person you are chatting with is named "${userName}". Reference their name occasionally and naturally, as a friend would.`;
  }

  systemInstruction += `\n\n${CHECKIN_PROMPT}`;

  const contents = conversationHistory.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] }));
  // Add a synthetic prompt to trigger the check-in generation
  contents.push({
    role: 'user',
    parts: [
      {
        text: '[System: Generate a proactive check-in message for this user based on the conversation history above.]',
      },
    ],
  });

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      contents,
      model: GEMINI_FLASH3_MODEL,
      config: { temperature: 0.9, systemInstruction, maxOutputTokens: 500 },
    });

    rawResponse = response.text?.trim();
    if (!rawResponse) return null; // treat empty response as no message to send

    return rawResponse;
  } catch (error) {
    logger.error('[ai] Failed to generate check-in message', {
      rawResponse,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export type IntroDraftUserProfile = {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  bio: string | null;
  tags: string[];
};

export type IntroDraftResult = {
  draft: string;
  systemPrompt: string;
};

export async function generateIntroDraft(
  conversationHistory: ConversationMessage[],
  userName: string | null,
  otherUser: IntroDraftUserProfile,
): Promise<IntroDraftResult | null> {
  const otherName = [otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ') || 'someone';
  const otherTitle = otherUser.title || 'interesting person';
  const otherBio = otherUser.bio || 'no bio yet';
  const otherTags = otherUser.tags.length > 0 ? otherUser.tags.join(', ') : 'none listed';

  let systemInstruction = SAYLA_SYSTEM_PROMPT;
  if (userName) {
    systemInstruction += `\n\n## Current User\nThe person you are texting is named "${userName}". Reference their name naturally.`;
  }

  systemInstruction +=
    '\n\n' +
    INTRO_DRAFT_PROMPT.replace('{otherName}', otherName)
      .replace('{otherTitle}', otherTitle)
      .replace('{otherBio}', otherBio)
      .replace('{otherTags}', otherTags);

  const contents = conversationHistory.map((msg) => ({ role: msg.role, parts: [{ text: msg.content }] }));

  contents.push({
    role: 'user',
    parts: [
      {
        text: '[System: Generate a message pitching an introduction to this user. Respond with ONLY the message text.]',
      },
    ],
  });

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      contents,
      model: GEMINI_FLASH3_MODEL,
      config: { temperature: 0.7, systemInstruction, maxOutputTokens: 1024 },
    });

    rawResponse = response.text?.trim();
    if (!rawResponse) return null;

    return { draft: rawResponse, systemPrompt: systemInstruction };
  } catch (error) {
    logger.error('[ai] Failed to generate intro draft', {
      rawResponse,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function classifyOptInResponse(messageContent: string): Promise<OptInClassificationResult> {
  const trimmed = messageContent.trim();

  let rawResponse: string | undefined;
  try {
    const response = await ai.models.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'Classify the following user message.' }] },
        { role: 'user', parts: [{ text: trimmed }] },
      ],
      model: GEMINI_FLASH3_MODEL,
      config: {
        systemInstruction: `You are a classification engine. A user was asked if they're interested in being introduced to someone new. Classify their reply.

Both fields are optional — only set them when applicable:

"result":
- "accepted" = they explicitly agreed to the introduction. Examples: "yes", "sure", "sounds great", "down", "yep", "let's do it", "I'm in".
- "declined" = they explicitly said no. Examples: "no thanks", "pass", "not interested", "nah", "I'm good".
- Omit "result" entirely if the message is neither a clear yes nor a clear no (e.g. questions, requests for info, conditional responses, or anything ambiguous).

"linkRequest":
- Set to the platform name if the user is requesting a social link about the other person (e.g. "send me their LinkedIn" → "linkedin", "what's their Instagram?" → "instagram").
- Omit if the user is not asking for a social link.

IMPORTANT: Asking for information about the other person (e.g. "send me their LinkedIn", "what do they do?") is NOT acceptance. A user can request a link without accepting or declining.

Always respond with valid JSON.`,
        temperature: 0.1,
        maxOutputTokens: 100,
        responseMimeType: 'application/json',
        responseJsonSchema: classifyCheckInResponseSchema.toJSONSchema(),
      },
    });

    rawResponse = response.text?.trim();

    const json = safeJsonParse(rawResponse);
    if (!json) return { result: null, linkRequest: null };

    const res = classifyCheckInResponseSchema.parse(json);
    return { result: res.result, linkRequest: res.linkRequest };
  } catch (error) {
    logger.error('[ai] Failed to classify opt-in response via Gemini', {
      rawResponse,
      messageContent: trimmed,
      error: error instanceof Error ? error.message : error,
    });
    return { result: null, linkRequest: null };
  }
}

/**
 * Decide whether to react to an inbound message with a tapback.
 * Skips most messages - only reacts when something genuinely warrants it.
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
          'You are Sayla, texting over iMessage. You RARELY react to messages — only when something genuinely stands out. Most messages should get NO reaction. Decide if the user message deserves a tapback reaction. Always respond with valid JSON.',
        temperature: 0.3,
        maxOutputTokens: 100,
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
