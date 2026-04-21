import crypto from 'node:crypto';
import { google } from 'googleapis';

import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';

/**
 * All Google scopes requested in the single consent flow.
 * Calendar: full read/write for events.
 * Contacts: read-only via People API.
 * Tasks: full read/write for Google Tasks.
 * Gmail: read-only for now (list + read threads). Write scopes come later.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export type GoogleCredentialsMissingError = { kind: 'missing-google-env' };

function getOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    return null;
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function buildConsentUrl(state: string): string | null {
  const client = getOAuthClient();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline', // required to get a refresh token
    prompt: 'consent', // force refresh_token to be returned even on re-consent
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export type GoogleTokenExchange = {
  refreshToken: string | null;
  accessToken: string;
  accessTokenExpiresAt: Date;
  email: string | null;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenExchange | null> {
  const client = getOAuthClient();
  if (!client) return null;

  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    logger.error('[google-oauth] Token exchange returned no access_token');
    return null;
  }

  const accessTokenExpiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 60 * 60 * 1000); // fallback: 1h

  // Extract email from the id_token if present
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1]!, 'base64').toString());
      email = typeof payload.email === 'string' ? payload.email : null;
    } catch (err) {
      logger.warn('[google-oauth] Failed to decode id_token', {
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token,
    accessTokenExpiresAt,
    email,
  };
}

/**
 * Returns a valid access token for the user, refreshing it if expired.
 * Future calendar tool calls will go through this.
 */
export async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      googleAccessTokenExpiresAt: true,
      googleRefreshToken: true,
    },
  });

  if (!user?.googleRefreshToken) return null;

  const SKEW_MS = 60 * 1000; // refresh 1 minute early
  if (
    user.googleAccessToken &&
    user.googleAccessTokenExpiresAt &&
    user.googleAccessTokenExpiresAt.getTime() - Date.now() > SKEW_MS
  ) {
    return user.googleAccessToken;
  }

  const client = getOAuthClient();
  if (!client) return null;

  client.setCredentials({ refresh_token: user.googleRefreshToken });
  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) return null;

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 60 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: credentials.access_token,
        googleAccessTokenExpiresAt: expiresAt,
      },
    });

    return credentials.access_token;
  } catch (error) {
    logger.error('[google-oauth] Failed to refresh access token', {
      userId: user.id,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

const CONNECT_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate (or refresh) a one-time connect token for the user and return
 * the full URL they can tap in iMessage to kick off the OAuth flow.
 */
export async function issueConnectLink(userId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + CONNECT_TOKEN_TTL_MS);

  await db.user.update({
    where: { id: userId },
    data: { connectToken: token, connectTokenExpiresAt: expiresAt },
  });

  // Link points at the public web frontend (CLIENT_URL), which hosts /connect.
  // In local dev, set CLIENT_URL to the deployed staging frontend (ea.getsayla.com)
  // so the link in iMessage is tappable from the owner's phone.
  return `${env.CLIENT_URL.split(',')[0]!.trim().replace(/\/$/, '')}/connect?t=${token}`;
}

export async function findUserByConnectToken(token: string) {
  const user = await db.user.findUnique({
    where: { connectToken: token },
    select: { id: true, connectTokenExpiresAt: true },
  });
  if (!user) return null;
  if (!user.connectTokenExpiresAt || user.connectTokenExpiresAt.getTime() < Date.now()) return null;
  return { id: user.id };
}

/**
 * Sign a state payload for the OAuth redirect. Uses JWT_SECRET (already in env)
 * as the HMAC key to avoid adding another secret.
 */
export function signOAuthState(userId: string): string {
  const payload = { userId, nonce: crypto.randomBytes(8).toString('base64url'), iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

export function verifyOAuthState(state: string): { userId: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.userId !== 'string' || typeof payload.iat !== 'number') return null;
    if (Date.now() - payload.iat > STATE_TTL_MS) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
