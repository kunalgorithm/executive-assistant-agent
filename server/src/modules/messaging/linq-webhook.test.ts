import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import express from 'express';
import Linq from '@linqapp/sdk';

import { createLinqWebhookHandler, linqWebhookBodyParser } from './linq-webhook';
import type { SendblueInboundPayload, SendblueStatusPayload } from './helpers';
import type { Prisma } from '@/generated/prisma/client';

const lineNumber = '+15555550100';
const peerNumber = '+15555550101';

function incoming() {
  return {
    event_id: 'event-1',
    event_type: 'message.received',
    webhook_version: '2026-02-03',
    data: {
      id: 'message-1',
      chat: { id: 'chat-1', is_group: false, owner_handle: { handle: lineNumber, is_me: true } },
      direction: 'inbound',
      sender_handle: { handle: peerNumber, is_me: false },
      parts: [{ type: 'text', value: 'Hello — calendar please 👋' }],
      service: 'iMessage',
      sent_at: '2026-09-09T01:11:45.025Z',
    },
  };
}

async function setup(t: TestContext) {
  const key = randomBytes(32);
  const client = new Linq({ apiKey: 'test-key', webhookSecret: `whsec_${key.toString('base64')}` });
  const inbound: Array<{ data: SendblueInboundPayload; metadata: Prisma.InputJsonObject }> = [];
  const statuses: SendblueStatusPayload[] = [];
  const logs: unknown[] = [];
  const log = (message: string, context: object) => logs.push({ message, context });
  const app = express();
  app.use('/webhook', linqWebhookBodyParser);
  app.use(express.json());
  app.post(
    '/webhook',
    createLinqWebhookHandler({
      getClient: () => client,
      lineNumber,
      logger: { info: log, warn: log },
      onInbound(data, res, metadata) {
        inbound.push({ data, metadata });
        res.sendStatus(200);
      },
      async onStatus(data, res) {
        statuses.push(data);
        res.sendStatus(200);
      },
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;

  async function send(payload: unknown, options: { timestamp?: number; unsigned?: boolean; signedBody?: string } = {}) {
    const body = JSON.stringify(payload, null, 2);
    const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', key)
      .update(`delivery-1.${timestamp}.${options.signedBody ?? body}`)
      .digest('base64');
    const response = await fetch(url, {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        ...(options.unsigned
          ? {}
          : {
              'webhook-id': 'delivery-1',
              'webhook-timestamp': timestamp,
              'webhook-signature': `v1,${signature}`,
            }),
      },
    });
    await response.text();
    return response.status;
  }
  return { send, inbound, statuses, logs };
}

test('valid signed UTF-8 body reaches the shared pipeline with scoped chat metadata', async (t) => {
  const { send, inbound, logs } = await setup(t);
  assert.equal(await send(incoming()), 200);
  assert.equal(inbound.length, 1);
  assert.equal(inbound[0]?.data.content, 'Hello — calendar please 👋');
  assert.equal(inbound[0]?.data.message_handle, 'linq:message-1');
  assert.deepEqual(inbound[0]?.metadata, {
    provider: 'linq',
    chatId: 'chat-1',
    lineNumber,
    peerNumber,
    eventId: 'event-1',
  });
  assert.ok(!JSON.stringify(logs).includes('calendar please'));
  assert.ok(!JSON.stringify(logs).includes(peerNumber));
});

test('missing signature, tampered bytes, expired and future timestamps cannot trigger actions', async (t) => {
  const { send, inbound, statuses } = await setup(t);
  assert.equal(await send(incoming(), { unsigned: true }), 401);
  assert.equal(await send(incoming(), { signedBody: JSON.stringify(incoming()) }), 401);
  const now = Math.floor(Date.now() / 1000);
  assert.equal(await send(incoming(), { timestamp: now - 600 }), 401);
  assert.equal(await send(incoming(), { timestamp: now + 600 }), 401);
  assert.equal(inbound.length, 0);
  assert.equal(statuses.length, 0);
});

test('wrong payload version and malformed message fail closed', async (t) => {
  const { send, inbound } = await setup(t);
  assert.equal(await send({ ...incoming(), webhook_version: '2025-01-01' }), 400);
  assert.equal(await send({ ...incoming(), data: { id: 'message-1' } }), 400);
  assert.equal(inbound.length, 0);
});

test('group chats, other lines, own messages and non-phone senders never trigger the EA', async (t) => {
  const { send, inbound } = await setup(t);
  const group = incoming();
  group.data.chat.is_group = true;
  assert.equal(await send(group), 200);
  const otherLine = incoming();
  otherLine.data.chat.owner_handle.handle = '+15555550199';
  assert.equal(await send(otherLine), 200);
  const outbound = incoming();
  outbound.data.direction = 'outbound';
  outbound.data.sender_handle.is_me = true;
  assert.equal(await send(outbound), 200);
  const emailSender = incoming();
  emailSender.data.sender_handle.handle = 'someone@example.com';
  assert.equal(await send(emailSender), 200);
  assert.equal(inbound.length, 0);
});

test('historical, empty and unsupported events are acknowledged without a reply', async (t) => {
  const { send, inbound, statuses } = await setup(t);
  const event = incoming();
  assert.equal(await send({ ...event, data: { ...event.data, reconciled_at: new Date().toISOString() } }), 200);
  assert.equal(await send({ ...event, data: { ...event.data, parts: [] } }), 200);
  assert.equal(await send({ ...event, event_type: 'reaction.added', data: {} }), 200);
  assert.equal(inbound.length, 0);
  assert.equal(statuses.length, 0);
});

test('repeated deliveries retain the message handle used by database deduplication', async (t) => {
  const { send, inbound } = await setup(t);
  assert.equal(await send(incoming()), 200);
  assert.equal(await send({ ...incoming(), event_id: 'event-2' }), 200);
  assert.equal(inbound[0]?.data.message_handle, inbound[1]?.data.message_handle);
});

test('text, links and media normalize without treating unknown parts as instructions', async (t) => {
  const { send, inbound } = await setup(t);
  const event = incoming();
  assert.equal(
    await send({
      ...event,
      data: {
        ...event.data,
        parts: [
          { type: 'text', value: 'Read this' },
          { type: 'link', value: 'https://example.com' },
          { type: 'media', url: 'https://example.com/image.png' },
          { type: 'imessage_app', value: 'ignored' },
        ],
      },
    }),
    200,
  );
  assert.equal(inbound[0]?.data.content, 'Read this\nhttps://example.com');
  assert.equal(inbound[0]?.data.media_url, 'https://example.com/image.png');
});

test('outbound delivery events update status without entering the inbound pipeline', async (t) => {
  const { send, inbound, statuses } = await setup(t);
  for (const status of ['sent', 'delivered', 'read']) {
    const event = incoming();
    event.event_type = `message.${status}`;
    event.data.direction = 'outbound';
    event.data.sender_handle.is_me = true;
    event.data.sender_handle.handle = lineNumber;
    assert.equal(await send(event), 200);
  }
  assert.deepEqual(
    statuses.map((s) => s.status),
    ['SENT', 'DELIVERED', 'READ'],
  );
  assert.ok(statuses.every((s) => s.message_handle === 'linq:message-1'));
  assert.equal(inbound.length, 0);
});

test('failed delivery uses the separate failure schema and preserves the error code', async (t) => {
  const { send, inbound, statuses } = await setup(t);
  assert.equal(
    await send({
      ...incoming(),
      event_type: 'message.failed',
      data: {
        message_id: 'message-1',
        code: 4001,
        reason: 'Failed to send',
      },
    }),
    200,
  );
  assert.equal(statuses[0]?.status, 'FAILED');
  assert.equal(statuses[0]?.error_code, 4001);
  assert.equal(statuses[0]?.message_handle, 'linq:message-1');
  assert.equal(inbound.length, 0);
});
