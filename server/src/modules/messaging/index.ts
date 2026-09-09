import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { asyncRoute } from '@/utils/error';
import { statusCodes } from '@/utils/http';
import { handleInboundMessageWebhook, handleStatusCallbackWebhook } from './webhook';

const messagingRouter: Router = Router();

// Mounted before body parsing and rate limiting so even rejected requests are visible.
export function logMessagingWebhookRequest(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const context = { requestId, method: req.method, path: req.originalUrl.split('?')[0] };
  res.locals.webhookRequestId = requestId;

  logger.info('[webhook] HTTP request received', {
    ...context,
    contentType: req.get('content-type') ?? null,
    hasSigningSecret: typeof req.headers['sb-signing-secret'] === 'string',
  });

  res.on('finish', () => {
    logger.info('[webhook] HTTP response sent', {
      ...context,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}

function validateWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const receivedSecret = req.headers['sb-signing-secret'];
  const receivedBuffer = typeof receivedSecret === 'string' ? Buffer.from(receivedSecret) : null;
  const expectedBuffer = Buffer.from(env.SENDBLUE_WEBHOOK_SECRET);

  if (
    !receivedBuffer ||
    receivedBuffer.length === 0 ||
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    logger.warn('[webhook] Authentication rejected', {
      requestId: res.locals.webhookRequestId,
      reason: receivedBuffer ? 'invalid_signing_secret' : 'missing_signing_secret',
      ip: req.ip,
    });
    res.sendStatus(statusCodes.UNAUTHORIZED);
    return;
  }
  next();
}

messagingRouter.post('/webhook/inbound', validateWebhookSecret, asyncRoute(handleInboundMessageWebhook));
messagingRouter.post('/webhook/status', validateWebhookSecret, asyncRoute(handleStatusCallbackWebhook));

export { messagingRouter };
