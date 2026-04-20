import crypto from 'node:crypto';

import type { ConnectorProviderId } from '@/modules/connectors/contracts';
import { env } from '@/utils/env';

export type ConnectorOAuthState = {
  userId: string;
  provider: ConnectorProviderId;
  returnTo?: string;
  issuedAt: string;
};

function sign(payload: string) {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
}

export function createConnectorOAuthStateToken(state: ConnectorOAuthState) {
  const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parseConnectorOAuthStateToken(token: string) {
  const [payload, signature] = token.split('.');

  if (!payload || !signature) {
    throw new Error('Invalid connector OAuth state');
  }

  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length) {
    throw new Error('Invalid connector OAuth signature');
  }

  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!matches) {
    throw new Error('Invalid connector OAuth signature');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ConnectorOAuthState;
}
