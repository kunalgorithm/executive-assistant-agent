import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { sendGroupIntro } from '@/modules/matching/engine';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { generateEmbedding, buildProfileContext } from '@/utils/embeddings';
import { generateIntroDraft, getUserConversation } from '@/modules/messaging/ai';
import { matchSelect, introduceStartSchema, introducePairSchema } from './helpers';
import { MATCH_STATUSES, PRIMARY_INTENTS, USER_STATUSES, type PrimaryIntent } from '@/utils/constants';

export async function handleSendGroupIntro(req: Request, res: Response) {
  const matchId = req.params.matchId as string;

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }
  if (match.status !== MATCH_STATUSES.ready) {
    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: { status: 'Match is not ready (both users must opt in first)' },
    });
    return;
  }

  await sendGroupIntro(matchId, match.userAId, match.userBId);

  const updated = await db.match.findUnique({
    where: { id: matchId },
    select: matchSelect,
  });

  trackEvent(ANALYTICS_EVENTS.group_introduction_sent, undefined, { matchId });

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}

export async function handleStartIntroduction(req: Request, res: Response) {
  const { data, errors } = getZodErrors(introduceStartSchema, req.body);
  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: errors });
    return;
  }

  const { userAId, userBId } = data;
  const users = await db.user.findMany({ where: { id: { in: [userAId, userBId] } } });
  if (users.length !== 2) {
    logger.error('[startIntroduction] One or both users not found for introduction', { userAId, userBId });
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { users: 'One or both users not found' } });
    return;
  }

  const userA = users.find((u) => u.id === userAId)!; // ! because length check is sufficient to guarantee existence (after IDs match)
  const userB = users.find((u) => u.id === userBId)!;

  if (!userA.phoneNumber || !userB.phoneNumber) {
    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: {
        ...(!userA.phoneNumber ? { userAId: 'User A has no phone number' } : {}),
        ...(!userB.phoneNumber ? { userBId: 'User B has no phone number' } : {}),
      },
    });
    return;
  }

  const existing = await db.match.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
  });

  if (existing) {
    res.status(statusCodes.CONFLICT).json({
      data: null,
      errors: { match: 'These users have already been introduced' },
    });
    return;
  }

  const [historyA, historyB] = await Promise.all([getUserConversation(userAId), getUserConversation(userBId)]);

  const [resultA, resultB] = await Promise.all([
    generateIntroDraft(historyA, userA.firstName, userB),
    generateIntroDraft(historyB, userB.firstName, userA),
  ]);

  const draftMessageA = resultA?.draft ?? null;
  const draftMessageB = resultB?.draft ?? null;

  const match = await db.match.create({
    data: { userAId, userBId, draftMessageA, draftMessageB, status: MATCH_STATUSES.drafting },
    select: matchSelect,
  });

  if (draftMessageA && draftMessageB) {
    await db.draftRevision.create({
      data: {
        matchId: match.id,
        aiDraftA: draftMessageA,
        aiDraftB: draftMessageB,
        adminDraftA: null,
        adminDraftB: null,
        context: {
          systemPromptA: resultA!.systemPrompt,
          systemPromptB: resultB!.systemPrompt,
          userA: {
            firstName: userA.firstName,
            lastName: userA.lastName,
            title: userA.title,
            bio: userA.bio,
            tags: userA.tags,
            conversationHistory: historyA,
          },
          userB: {
            firstName: userB.firstName,
            lastName: userB.lastName,
            title: userB.title,
            bio: userB.bio,
            tags: userB.tags,
            conversationHistory: historyB,
          },
        },
      },
    });
  }

  trackEvent(ANALYTICS_EVENTS.introduction_drafts_generated, undefined, { matchId: match.id, userAId, userBId });

  res.status(statusCodes.CREATED).json({ data: match, errors: null });
}

function computeIntentCompatibility(intentA: string | null, intentB: string | null): boolean {
  if (!intentA || !intentB) return false;
  const configA = PRIMARY_INTENTS[intentA as PrimaryIntent];
  const configB = PRIMARY_INTENTS[intentB as PrimaryIntent];
  if (!configA || !configB) return false;
  return (
    (configA.compatibleWith as readonly string[]).includes(intentB) &&
    (configB.compatibleWith as readonly string[]).includes(intentA)
  );
}

export async function handleCompatibilityCheck(req: Request, res: Response) {
  const { data, errors } = getZodErrors(introducePairSchema, req.body);
  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  const { userAId, userBId } = data;

  const users = await db.user.findMany({
    where: { id: { in: [userAId, userBId] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      substatus: true,
      primaryIntent: true,
      phoneNumber: true,
      title: true,
      bio: true,
      tags: true,
    },
  });

  if (users.length !== 2) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { users: 'One or both users not found' } });
    return;
  }

  const userA = users.find((u) => u.id === userAId)!;
  const userB = users.find((u) => u.id === userBId)!;

  const warnings: string[] = [];

  // Status warnings
  const readyStatus = USER_STATUSES.ready_to_match.label;
  if (userA.status !== readyStatus) {
    warnings.push(`${userA.firstName ?? 'User A'} is still ${userA.status} (${userA.substatus ?? 'no substatus'})`);
  }
  if (userB.status !== readyStatus) {
    warnings.push(`${userB.firstName ?? 'User B'} is still ${userB.status} (${userB.substatus ?? 'no substatus'})`);
  }

  // Phone number warnings
  if (!userA.phoneNumber) warnings.push(`${userA.firstName ?? 'User A'} has no phone number`);
  if (!userB.phoneNumber) warnings.push(`${userB.firstName ?? 'User B'} has no phone number`);

  // Intent compatibility
  const intentCompatible = computeIntentCompatibility(userA.primaryIntent, userB.primaryIntent);
  if (!intentCompatible) {
    const labelA = userA.primaryIntent
      ? (PRIMARY_INTENTS[userA.primaryIntent as PrimaryIntent]?.label ?? userA.primaryIntent)
      : 'none';
    const labelB = userB.primaryIntent
      ? (PRIMARY_INTENTS[userB.primaryIntent as PrimaryIntent]?.label ?? userB.primaryIntent)
      : 'none';
    warnings.push(`Incompatible intents: ${labelA} ↔ ${labelB}`);
  }

  // Existing match check
  const existing = await db.match.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
    select: { id: true, status: true },
  });
  if (existing) warnings.push(`Already matched (status: ${existing.status})`);

  // Similarity score — use stored embeddings if available, otherwise generate ephemeral ones
  let similarityScore: number | null = null;

  if (userA.status === readyStatus && userB.status === readyStatus) {
    const rows = await db.$queryRawUnsafe<{ distance: number }[]>(
      `SELECT (SELECT embedding FROM users WHERE id = $1)::vector <=> (SELECT embedding FROM users WHERE id = $2)::vector AS distance`,
      userAId,
      userBId,
    );
    if (rows[0] && rows[0].distance != null) {
      similarityScore = Math.round(Math.max(0, 1 - rows[0].distance) * 1000) / 1000;
    }
  } else {
    const contextA = buildProfileContext(userA);
    const contextB = buildProfileContext(userB);

    try {
      const [embeddingA, embeddingB] = await Promise.all([generateEmbedding(contextA), generateEmbedding(contextB)]);
      const dotProduct = embeddingA.reduce((sum, val, i) => sum + val * embeddingB[i]!, 0);
      similarityScore = Math.round(Math.max(0, dotProduct) * 1000) / 1000;
      logger.info('Computed ephemeral similarity score', { similarityScore, userA: userA.id, userB: userB.id });
    } catch (err) {
      logger.warn('[compatibilityCheck] Failed to generate ephemeral embeddings', {
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  res.status(statusCodes.OK).json({
    errors: null,
    data: {
      warnings,
      similarityScore,
      intentCompatible,
      userA: { status: userA.status, primaryIntent: userA.primaryIntent },
      userB: { status: userB.status, primaryIntent: userB.primaryIntent },
    },
  });
}
