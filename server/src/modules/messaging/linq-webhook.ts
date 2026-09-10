import express, { type Request, type Response, type RequestHandler } from 'express';
import type Linq from '@linqapp/sdk';
import { z } from 'zod';

import type { Prisma } from '@/generated/prisma/client';
import type { SendblueInboundPayload, SendblueStatusPayload } from './helpers';

// Must run BEFORE express.json(): Standard Webhooks signs the exact request bytes.
export const linqWebhookBodyParser: RequestHandler = express.raw({ type: 'application/json', limit: '10mb' });

const envelopeSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string(),
  webhook_version: z.literal('2026-02-03'),
  data: z.unknown(),
});

const messageSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  chat: z.object({
    id: z.string().min(1),
    is_group: z.boolean(),
    owner_handle: z.object({ handle: z.string(), is_me: z.literal(true) }),
  }),
  sender_handle: z.object({ handle: z.string(), is_me: z.boolean() }),
  service: z.string(),
  parts: z.array(z.object({ type: z.string(), value: z.string().optional(), url: z.url().optional() })),
  sent_at: z.iso.datetime({ offset: true }).nullish(),
  reconciled_at: z.string().nullish(),
});

const failureSchema = z.object({
  message_id: z.string().min(1),
  code: z.number(),
  reason: z.string().optional(),
});

type Dependencies = {
  getClient: () => Pick<Linq, 'webhooks'>;
  lineNumber: string;
  logger: { info: (message: string, context: object) => unknown; warn: (message: string, context: object) => unknown };
  onInbound: (data: SendblueInboundPayload, res: Response, metadata: Prisma.InputJsonObject) => void;
  onStatus: (data: SendblueStatusPayload, res: Response) => Promise<void>;
};

export function createLinqWebhookHandler({ getClient, lineNumber, logger, onInbound, onStatus }: Dependencies) {
  return async (req: Request, res: Response) => {
    const context = { requestId: res.locals.webhookRequestId, provider: 'linq' };
    if (!Buffer.isBuffer(req.body)) {
      logger.warn('[webhook] Linq request must contain raw JSON', context);
      res.sendStatus(400);
      return;
    }

    let payload: unknown;
    try {
      // Always pass headers: omitting them disables verification in the SDK.
      payload = getClient().webhooks.unwrap(req.body.toString('utf8'), {
        headers: {
          'webhook-id': req.get('webhook-id') ?? '',
          'webhook-timestamp': req.get('webhook-timestamp') ?? '',
          'webhook-signature': req.get('webhook-signature') ?? '',
        },
      });
    } catch {
      logger.warn('[webhook] Linq authentication rejected', context);
      res.sendStatus(401);
      return;
    }

    const envelope = envelopeSchema.safeParse(payload);
    if (!envelope.success) {
      logger.warn('[webhook] Invalid Linq event or unsupported webhook version', context);
      res.sendStatus(400);
      return;
    }
    const event = envelope.data;
    const eventContext = { ...context, eventId: event.event_id, eventType: event.event_type };
    logger.info('[webhook] Linq signature verified; event received', eventContext);

    if (event.event_type === 'message.failed') {
      const failure = failureSchema.safeParse(event.data);
      if (!failure.success) {
        logger.warn('[webhook] Linq failure event has no valid message reference', eventContext);
        res.sendStatus(400);
        return;
      }
      await onStatus(
        {
          message_handle: `linq:${failure.data.message_id}`,
          status: 'FAILED',
          error_code: failure.data.code,
          error_message: failure.data.reason,
        },
        res,
      );
      return;
    }

    if (!['message.received', 'message.sent', 'message.delivered', 'message.read'].includes(event.event_type)) {
      logger.info('[webhook] Ignoring unsupported Linq event', eventContext);
      res.sendStatus(200);
      return;
    }
    const parsed = messageSchema.safeParse(event.data);
    if (!parsed.success) {
      logger.warn('[webhook] Invalid Linq message payload', eventContext);
      res.sendStatus(400);
      return;
    }
    const message = parsed.data;
    if (message.chat.is_group || message.chat.owner_handle.handle !== lineNumber) {
      logger.info('[webhook] Ignoring Linq group chat or other line', eventContext);
      res.sendStatus(200);
      return;
    }

    if (event.event_type !== 'message.received') {
      if (message.direction === 'outbound' && message.sender_handle.is_me) {
        await onStatus({ message_handle: `linq:${message.id}`, status: event.event_type.slice(8).toUpperCase() }, res);
      } else {
        res.sendStatus(200);
      }
      return;
    }

    if (message.direction !== 'inbound' || message.sender_handle.is_me || message.reconciled_at) {
      logger.info('[webhook] Ignoring Linq outbound or historical message', eventContext);
      res.sendStatus(200);
      return;
    }
    const peerNumber = message.sender_handle.handle;
    if (!/^\+[1-9]\d{7,14}$/.test(peerNumber)) {
      logger.warn('[webhook] Linq sender is not a phone number', eventContext);
      res.sendStatus(200);
      return;
    }
    const content = message.parts
      .filter((part) => part.type === 'text' || part.type === 'link')
      .map((part) => part.value ?? '')
      .join('\n');
    const mediaUrl = message.parts.find((part) => part.type === 'media')?.url;
    if (!content.trim() && !mediaUrl) {
      logger.info('[webhook] Ignoring Linq message without supported content', eventContext);
      res.sendStatus(200);
      return;
    }

    onInbound(
      {
        message_handle: `linq:${message.id}`,
        from_number: peerNumber,
        to_number: lineNumber,
        content,
        media_url: mediaUrl,
        is_outbound: false,
        service: message.service,
        date_sent: message.sent_at ?? undefined,
        message_type: 'message',
      },
      res,
      {
        provider: 'linq',
        chatId: message.chat.id,
        lineNumber,
        peerNumber,
        eventId: event.event_id,
      },
    );
  };
}
