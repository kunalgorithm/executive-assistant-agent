import type { Request, Response } from 'express';

import {
  matchSelect,
  matchIdParamSchema,
  updateDraftsSchema,
  activeMatchStatuses,
  getConversationSchema,
  usersPaginationSchema,
  conversationQuerySchema,
} from './helpers';
import { db } from '@/utils/db';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { MATCH_STATUSES, MESSAGE_TYPES } from '@/utils/constants';

export async function handleListUsers(req: Request, res: Response) {
  const { data: query, errors: queryErrors } = getZodErrors(usersPaginationSchema, req.query);
  if (queryErrors || !query) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: queryErrors });
    return;
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      orderBy: { [query.sort]: query.sort === 'lastMessageAt' ? { sort: query.order, nulls: 'last' } : query.order },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      omit: { refId: true },
      include: {
        matchesAsA: { where: { status: { in: activeMatchStatuses } }, select: { id: true } },
        matchesAsB: { where: { status: { in: activeMatchStatuses } }, select: { id: true } },
      },
    }),

    db.user.count(),
  ]);

  const items = users.map((u) => {
    const matchCount = u.matchesAsA.length + u.matchesAsB.length;
    return {
      ...u,
      hasActiveMatches: matchCount > 0,
      matchCount,
      matchesAsA: undefined,
      matchesAsB: undefined,
    };
  });

  res.status(statusCodes.OK).json({ data: { items, total, page: query.page, limit: query.limit }, errors: null });
}

export async function handleGetDirectConversation(req: Request, res: Response) {
  const { data: params, errors: paramErrors } = getZodErrors(getConversationSchema, req.params);
  if (paramErrors || !params) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: paramErrors });
    return;
  }

  const { data: query, errors: queryErrors } = getZodErrors(conversationQuerySchema, req.query);
  if (queryErrors || !query) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: queryErrors });
    return;
  }

  const messages = await db.channelMessage.findMany({
    where: {
      messageType: MESSAGE_TYPES.direct,
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      OR: [{ fromUserId: params.userId }, { toUserId: params.userId }],
    },
    take: query.limit,
    orderBy: { createdAt: 'desc' },
    omit: { updatedAt: true, sendblueData: true, messageHandle: true },
  });

  const nextCursor = messages.length === query.limit ? messages[messages.length - 1]!.id : null;

  res.status(statusCodes.OK).json({ data: { messages: messages.reverse(), nextCursor }, errors: null });
}

export async function handleGetGroupConversation(req: Request, res: Response) {
  const { data: params, errors: paramErrors } = getZodErrors(matchIdParamSchema, req.params);
  if (paramErrors || !params) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: paramErrors });
    return;
  }

  const { data: query, errors: queryErrors } = getZodErrors(conversationQuerySchema, req.query);
  if (queryErrors || !query) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: queryErrors });
    return;
  }

  const messages = await db.channelMessage.findMany({
    where: {
      matchId: params.matchId,
      messageType: MESSAGE_TYPES.group,
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    },
    take: query.limit,
    orderBy: { createdAt: 'desc' },
    omit: { updatedAt: true, sendblueData: true, messageHandle: true },
  });

  const nextCursor = messages.length === query.limit ? messages[messages.length - 1]!.id : null;

  res.status(statusCodes.OK).json({ data: { messages: messages.reverse(), nextCursor }, errors: null });
}

export async function handleUpdateDrafts(req: Request, res: Response) {
  const matchId = req.params.matchId as string;
  const { data, errors } = getZodErrors(updateDraftsSchema, req.body);
  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }

  if (match.status !== MATCH_STATUSES.drafting) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { status: 'Match is not in drafting status' } });
    return;
  }

  const updateData: Record<string, string> = {};
  if (data.draftMessageA) updateData.draftMessageA = data.draftMessageA;
  if (data.draftMessageB) updateData.draftMessageB = data.draftMessageB;

  const updated = await db.match.update({
    where: { id: matchId },
    data: updateData,
    select: matchSelect,
  });

  if (Object.keys(updateData).length > 0) {
    await db.draftRevision.update({
      where: { matchId },
      data: {
        ...(data.draftMessageA ? { adminDraftA: data.draftMessageA } : {}),
        ...(data.draftMessageB ? { adminDraftB: data.draftMessageB } : {}),
      },
    });
  }

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}
