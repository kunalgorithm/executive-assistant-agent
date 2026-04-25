import crypto from 'node:crypto';

import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { getPrimaryAccountForFeature, updateConnectedAccountAccessToken } from '@/modules/integrations/accounts';

const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
export const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'email',
  'User.Read',
  'Calendars.ReadWrite',
  'Contacts.Read',
  'Tasks.ReadWrite',
  'Mail.Read',
];

export type MicrosoftTokenExchange = {
  refreshToken: string | null;
  accessToken: string;
  accessTokenExpiresAt: Date;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  scopes: string[];
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftProfile = {
  id?: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export function microsoftOAuthConfigured() {
  return !!env.MICROSOFT_CLIENT_ID && !!env.MICROSOFT_CLIENT_SECRET && !!env.MICROSOFT_REDIRECT_URI;
}

export function buildMicrosoftConsentUrl(state: string): string | null {
  if (!microsoftOAuthConfigured()) return null;

  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_REDIRECT_URI!,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES.join(' '),
    state,
    prompt: 'select_account',
  });

  return `${MICROSOFT_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(code: string): Promise<MicrosoftTokenExchange | null> {
  if (!microsoftOAuthConfigured()) return null;

  const response = await fetch(`${MICROSOFT_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID!,
      client_secret: env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: env.MICROSOFT_REDIRECT_URI!,
      grant_type: 'authorization_code',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token) {
    logger.error('[microsoft-oauth] Token exchange failed', {
      status: response.status,
      error: data.error,
      description: data.error_description,
    });
    return null;
  }

  const profile = await fetchMicrosoftProfile(data.access_token);
  const jwtProfile = decodeMicrosoftIdToken(data.id_token);
  const providerAccountId = profile?.id ?? jwtProfile.sub;

  if (!providerAccountId) {
    logger.error('[microsoft-oauth] Could not determine Microsoft account id');
    return null;
  }

  return {
    refreshToken: data.refresh_token ?? null,
    accessToken: data.access_token,
    accessTokenExpiresAt: expiresAtFromSeconds(data.expires_in),
    providerAccountId,
    email: profile?.mail ?? profile?.userPrincipalName ?? jwtProfile.email,
    displayName: profile?.displayName ?? jwtProfile.name,
    scopes: data.scope?.split(/\s+/).filter(Boolean) ?? MICROSOFT_SCOPES,
  };
}

export async function getMicrosoftAccessTokenForAccount(accountId: string): Promise<string | null> {
  const account = await db.connectedAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      refreshToken: true,
      accessToken: true,
      accessTokenExpiresAt: true,
    },
  });

  if (!account?.refreshToken) return null;

  if (
    account.accessToken &&
    account.accessTokenExpiresAt &&
    account.accessTokenExpiresAt.getTime() - Date.now() > TOKEN_EXPIRY_SKEW_MS
  ) {
    return account.accessToken;
  }

  return refreshMicrosoftAccessToken(account.id, account.refreshToken);
}

export async function getMicrosoftAccessTokenForUser(
  userId: string,
  feature: 'calendar' | 'contacts' | 'tasks' | 'email',
) {
  const account = await getPrimaryAccountForFeature(userId, feature, ['microsoft']);
  if (!account) return null;
  return getMicrosoftAccessTokenForAccount(account.id);
}

async function refreshMicrosoftAccessToken(accountId: string, refreshToken: string) {
  if (!microsoftOAuthConfigured()) return null;

  const response = await fetch(`${MICROSOFT_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID!,
      client_secret: env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      redirect_uri: env.MICROSOFT_REDIRECT_URI!,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES.join(' '),
    }),
  });

  const data = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token) {
    logger.error('[microsoft-oauth] Failed to refresh access token', {
      accountId,
      status: response.status,
      error: data.error,
    });
    return null;
  }

  await updateConnectedAccountAccessToken(accountId, data.access_token, expiresAtFromSeconds(data.expires_in));
  return data.access_token;
}

async function fetchMicrosoftProfile(accessToken: string): Promise<MicrosoftProfile | null> {
  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me?$select=id,displayName,mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as MicrosoftProfile;
  } catch (error) {
    logger.warn('[microsoft-oauth] Failed to fetch Microsoft profile', {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

function decodeMicrosoftIdToken(idToken: string | undefined) {
  if (!idToken) return { sub: null, email: null, name: null };

  try {
    const parts = idToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString()) as {
      oid?: string;
      sub?: string;
      preferred_username?: string;
      email?: string;
      name?: string;
    };
    return {
      sub: payload.oid ?? payload.sub ?? null,
      email: payload.email ?? payload.preferred_username ?? null,
      name: payload.name ?? null,
    };
  } catch (error) {
    logger.warn('[microsoft-oauth] Failed to decode id_token', {
      error: error instanceof Error ? error.message : error,
    });
    return { sub: null, email: null, name: null };
  }
}

function expiresAtFromSeconds(expiresIn: number | undefined) {
  return new Date(Date.now() + (expiresIn ?? 3600) * 1000);
}

export function signMicrosoftOAuthState(userId: string): string {
  const payload = { userId, nonce: crypto.randomBytes(8).toString('base64url'), iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function verifyMicrosoftOAuthState(state: string): { userId: string } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as { userId?: unknown; iat?: unknown };
    if (typeof payload.userId !== 'string' || typeof payload.iat !== 'number') return null;
    if (Date.now() - payload.iat > STATE_TTL_MS) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
