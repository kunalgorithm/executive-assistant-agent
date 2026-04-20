import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { analyticsQuerySchema } from './helpers';
import { ANALYTICS_EVENTS } from '@/utils/analytics';

export async function handleListAnalyticsEvents(req: Request, res: Response) {
  const { data, errors } = getZodErrors(analyticsQuerySchema, req.query);
  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  const limit = data.limit ?? 50;

  const where: Record<string, unknown> = {};

  if (data.events) {
    const eventList = data.events.split(',').filter(Boolean);
    if (eventList.length > 0) where.event = { in: eventList };
  }

  if (data.userIds) {
    const userIdList = data.userIds.split(',').filter(Boolean);
    if (userIdList.length > 0) where.userId = { in: userIdList };
  }

  const createdAtFilter: Record<string, string> = {};
  if (data.after) createdAtFilter.gt = data.after;
  if (data.before) createdAtFilter.lt = data.before;

  if (data.cursor) {
    const cursorEvent = await db.analyticsEvent.findUnique({ where: { id: data.cursor }, select: { createdAt: true } });
    if (cursorEvent) createdAtFilter.lt = cursorEvent.createdAt.toISOString();
  }

  if (Object.keys(createdAtFilter).length > 0) where.createdAt = createdAtFilter;

  const rows = await db.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      event: true,
      userId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true },
      },
    },
  });

  // Resolve user names for all userId references in this page
  const uniqueUserIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const userRows =
    uniqueUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const users: Record<string, string> = {};
  for (const u of userRows) {
    users[u.id] = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id;
  }

  const nextCursor = rows.length === limit ? rows[rows.length - 1]!.id : null;

  res.status(statusCodes.OK).json({ data: { events: rows, nextCursor, users }, errors: null });
}

export function handleGetDistinctEvents(_req: Request, res: Response) {
  const data = Object.values(ANALYTICS_EVENTS);
  res.status(statusCodes.OK).json({ data, errors: null });
}
