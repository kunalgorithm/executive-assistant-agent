import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { getZodErrors } from '@/utils/error';
import { updateNotesSchema } from './helpers';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';

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
