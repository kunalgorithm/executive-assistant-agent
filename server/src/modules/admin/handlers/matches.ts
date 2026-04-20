import type { Request, Response } from 'express';

import {
  OTHERS_STATUSES,
  matchesQuerySchema,
  matchSelectWithProfiles,
  handleRefreshUserMatchesSchema,
} from './helpers';
import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { MATCH_STATUSES } from '@/utils/constants';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { generateIntroDraft, getUserConversation } from '@/modules/messaging/ai';
import { findCandidatesForUser, createSuggestedMatches } from '@/modules/matching/algorithm';

export async function handleListMatches(req: Request, res: Response) {
  const { data: query, errors: queryErrors } = getZodErrors(matchesQuerySchema, req.query);
  if (queryErrors || !query) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: queryErrors });
    return;
  }

  const where =
    query.status === 'all'
      ? {}
      : query.status === 'others'
        ? { status: { in: OTHERS_STATUSES } }
        : { status: query.status };

  const [matches, total] = await Promise.all([
    db.match.findMany({
      where,
      take: query.limit,
      select: matchSelectWithProfiles,
      skip: (query.page - 1) * query.limit,
      orderBy: { [query.sort]: query.sort === 'score' ? { sort: query.order, nulls: 'last' } : query.order },
    }),

    db.match.count({ where }),
  ]);

  res.status(statusCodes.OK).json({
    errors: null,
    data: { items: matches, total, page: query.page, limit: query.limit },
  });
}

export async function handleApproveMatch(req: Request, res: Response) {
  const matchId = req.params.matchId as string;

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      userA: { select: { id: true, firstName: true, lastName: true, title: true, bio: true, tags: true } },
      userB: { select: { id: true, firstName: true, lastName: true, title: true, bio: true, tags: true } },
    },
  });

  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }

  if (match.status !== MATCH_STATUSES.suggested) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { status: 'Match is not in suggested status' } });
    return;
  }

  // Generate intro drafts
  const [historyA, historyB] = await Promise.all([
    getUserConversation(match.userAId),
    getUserConversation(match.userBId),
  ]);

  const [resultA, resultB] = await Promise.all([
    generateIntroDraft(historyA, match.userA.firstName, match.userB),
    generateIntroDraft(historyB, match.userB.firstName, match.userA),
  ]);

  const draftMessageA = resultA?.draft ?? null;
  const draftMessageB = resultB?.draft ?? null;

  const updated = await db.match.update({
    where: { id: matchId },
    data: { status: MATCH_STATUSES.drafting, draftMessageA, draftMessageB },
    select: matchSelectWithProfiles,
  });

  if (draftMessageA && draftMessageB) {
    await db.draftRevision.create({
      data: {
        matchId,
        aiDraftA: draftMessageA,
        aiDraftB: draftMessageB,
        context: {
          systemPromptA: resultA!.systemPrompt,
          systemPromptB: resultB!.systemPrompt,
          userA: {
            firstName: match.userA.firstName,
            lastName: match.userA.lastName,
            title: match.userA.title,
            bio: match.userA.bio,
            tags: match.userA.tags,
            conversationHistory: historyA,
          },
          userB: {
            firstName: match.userB.firstName,
            lastName: match.userB.lastName,
            title: match.userB.title,
            bio: match.userB.bio,
            tags: match.userB.tags,
            conversationHistory: historyB,
          },
        },
      },
    });
  }

  logger.info('[matching] Match approved, drafts generated', { matchId });
  trackEvent(ANALYTICS_EVENTS.match_approved, undefined, { matchId });

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}

export async function handleRejectMatch(req: Request, res: Response) {
  const matchId = req.params.matchId as string;

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }

  if (match.status !== MATCH_STATUSES.suggested) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { status: 'Match is not in suggested status' } });
    return;
  }

  await db.match.update({
    where: { id: matchId },
    data: { status: MATCH_STATUSES.rejected },
  });

  logger.info('[matching] Match rejected', { matchId });
  trackEvent(ANALYTICS_EVENTS.match_rejected, undefined, { matchId });

  res.status(statusCodes.OK).json({ data: { id: matchId, status: MATCH_STATUSES.rejected }, errors: null });
}

export async function handleRefreshUserMatches(req: Request, res: Response) {
  const { data: params, errors: paramsErrors } = getZodErrors(handleRefreshUserMatchesSchema, req.params);
  if (paramsErrors || !params) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: paramsErrors });
    return;
  }

  const userId = params.userId;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { user: 'User not found' } });
    return;
  }

  const candidates = await findCandidatesForUser(userId);
  let created = 0;
  if (candidates.length > 0) {
    created = await createSuggestedMatches(userId, candidates);
  }

  logger.info('[matching] User matches refreshed', { userId, candidates: candidates.length, created });

  res.status(statusCodes.OK).json({ data: { userId, candidates: candidates.length, created }, errors: null });
}
