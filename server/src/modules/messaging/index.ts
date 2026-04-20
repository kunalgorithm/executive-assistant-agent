import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { asyncRoute } from '@/utils/error';
import { statusCodes } from '@/utils/http';
import { handleInboundMessageWebhook, handleStatusCallbackWebhook } from './webhook';

const messagingRouter: Router = Router();

function validateWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const receivedSecret = req.headers['sb-signing-secret'];

  if (
    !receivedSecret ||
    typeof receivedSecret !== 'string' ||
    !crypto.timingSafeEqual(Buffer.from(receivedSecret), Buffer.from(env.SENDBLUE_WEBHOOK_SECRET))
  ) {
    logger.warn('[webhook-auth] Secret mismatch', { ip: req.ip });
    res.sendStatus(statusCodes.UNAUTHORIZED);
    return;
  }
  next();
}

messagingRouter.post('/webhook/inbound', validateWebhookSecret, asyncRoute(handleInboundMessageWebhook));
messagingRouter.post('/webhook/status', validateWebhookSecret, asyncRoute(handleStatusCallbackWebhook));

export { messagingRouter };
