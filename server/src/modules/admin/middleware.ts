import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];

  if (!key || typeof key !== 'string' || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(env.JWT_SECRET))) {
    logger.warn('[admin-auth] Unauthorized access attempt', { ip: req.ip, path: req.path, method: req.method });
    res.status(statusCodes.UNAUTHORIZED).json({ data: null, errors: { auth: 'Unauthorized' } });
    return;
  }

  next();
}
