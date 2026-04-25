import type { Request, Response } from 'express';

import { getConversationSchema, usersPaginationSchema, conversationQuerySchema } from './helpers';
import { db } from '@/utils/db';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { getConnectedAccounts } from '@/modules/integrations/accounts';

export async function handleListUsers(req: Request, res: Response) {
  const { data: query, errors: queryErrors } = getZodErrors(usersPaginationSchema, req.query);
  if (queryErrors || !query) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: queryErrors });
    return;
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      orderBy: { [query.sort]: query.sort === 'lastMessageAt' ? { sort: query.order, nulls: 'last' } : query.order },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      omit: { refId: true },
    }),
    db.user.count(),
  ]);

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

export async function handleGetUserConnectedAccounts(req: Request, res: Response) {
  const { data: params, errors: paramErrors } = getZodErrors(getConversationSchema, req.params);
  if (paramErrors || !params) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: paramErrors });
    return;
  }

  const accounts = await getConnectedAccounts(params.userId);
  res.status(statusCodes.OK).json({ data: { accounts }, errors: null });
}
