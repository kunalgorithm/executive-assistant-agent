import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { updateNotesSchema } from './helpers';
import { SMS_TEMPLATES } from '@/utils/constants';
import { sendAndSaveOutbound } from '@/modules/messaging/send';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';

export async function handleSendContactCard(req: Request, res: Response) {
  const userId = req.params.userId as string;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, phoneNumber: true, firstName: true },
  });

  if (!user) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { user: 'User not found' } });
    return;
  }
  if (!user.phoneNumber) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { phone: 'User has no phone number' } });
    return;
  }

  logger.info('[admin] Sending contact card to user', { userId, phoneNumber: user.phoneNumber });
  await sendAndSaveOutbound(
    'hey save my number btw 👆',
    user.phoneNumber,
    userId,
    SMS_TEMPLATES.WELCOME_CONTACT_CARD_URL,
  );
  logger.info('[admin] Contact card sent', { userId });
  trackEvent(ANALYTICS_EVENTS.contact_card_sent, userId);

  res.status(statusCodes.OK).json({ data: { success: true }, errors: null });
}

export async function handleUpdateAdminNotes(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const parsed = getZodErrors(updateNotesSchema, req.body);
  if (parsed.errors) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: parsed.errors });
    return;
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { user: 'User not found' } });
    return;
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { adminNotes: parsed.data!.notes || null },
    select: { id: true, adminNotes: true },
  });

  logger.info('[admin] Updated admin notes', { userId, notesLength: parsed.data!.notes.length });
  trackEvent(ANALYTICS_EVENTS.admin_notes_updated, userId);

  res.status(statusCodes.OK).json({ data: updated, errors: null });
}
