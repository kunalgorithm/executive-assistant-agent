import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { MATCH_STATUSES } from '@/utils/constants';
import { sendAndSaveOutbound } from '@/modules/messaging/send';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';
import { matchSelect, toggleOptInSchema, toggleOptInParamsSchema } from './helpers';

export async function handleSendOptIn(req: Request, res: Response) {
  const matchId = req.params.matchId as string;

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      userA: { select: { id: true, phoneNumber: true } },
      userB: { select: { id: true, phoneNumber: true } },
    },
  });

  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }
  if (match.status !== MATCH_STATUSES.drafting) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { status: 'Match is not in drafting status' } });
    return;
  }
  if (!match.draftMessageA || !match.draftMessageB) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { drafts: 'Both draft messages are required' } });
    return;
  }
  if (!match.userA.phoneNumber || !match.userB.phoneNumber) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { phone: 'Both users must have phone numbers' } });
    return;
  }

  // Send opt-in messages to both users
  await Promise.all([
    sendAndSaveOutbound(match.draftMessageA, match.userA.phoneNumber, match.userAId),
    sendAndSaveOutbound(match.draftMessageB, match.userB.phoneNumber, match.userBId),
  ]);

  // Update match status
  await db.match.update({
    where: { id: matchId },
    data: { status: MATCH_STATUSES.awaiting_opt_in },
  });

  const updated = await db.match.findUnique({
    where: { id: matchId },
    select: matchSelect,
  });

  logger.info('Opt-in messages sent', { matchId, userAId: match.userAId, userBId: match.userBId });
  trackEvent(ANALYTICS_EVENTS.opt_in_sent, undefined, { matchId, userAId: match.userAId, userBId: match.userBId });

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}

export async function handleToggleOptIn(req: Request, res: Response) {
  const { data: params, errors: paramsErrors } = getZodErrors(toggleOptInParamsSchema, req.params);
  if (paramsErrors || !params) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: paramsErrors });
    return;
  }

  const { data: body, errors: bodyErrors } = getZodErrors(toggleOptInSchema, req.body);
  if (bodyErrors || !body) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: bodyErrors });
    return;
  }

  const match = await db.match.findUnique({ where: { id: params.matchId } });
  if (!match) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { match: 'Match not found' } });
    return;
  }
  if (match.status !== MATCH_STATUSES.awaiting_opt_in && match.status !== MATCH_STATUSES.ready) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { status: 'Match is not awaiting opt-in' } });
    return;
  }

  const isUserA = match.userAId === body.userId;
  const isUserB = match.userBId === body.userId;
  if (!isUserA && !isUserB) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { userId: 'User is not part of this match' } });
    return;
  }

  const result: { userAOptedIn?: boolean; userBOptedIn?: boolean; status?: string } = isUserA
    ? { userAOptedIn: body.optedIn }
    : { userBOptedIn: body.optedIn };

  // Determine new status based on both opt-ins
  const otherOptedIn = isUserA ? match.userBOptedIn : match.userAOptedIn;
  if (body.optedIn && otherOptedIn) result.status = MATCH_STATUSES.ready;
  else if (!body.optedIn && match.status === MATCH_STATUSES.ready) result.status = MATCH_STATUSES.awaiting_opt_in;

  const updated = await db.match.update({
    data: result,
    select: matchSelect,
    where: { id: params.matchId },
  });

  const data = { ...params, ...body, newStatus: result.status || match.status };
  logger.info('Admin toggled opt-in', data);
  trackEvent(ANALYTICS_EVENTS.admin_opt_in_toggled, body.userId, data);

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}
