import type { Request, Response } from 'express';

import {
  buildConsentUrl,
  signOAuthState,
  verifyOAuthState,
  exchangeCodeForTokens,
  findUserByConnectToken,
} from './oauth';
import { fetchPrimaryCalendarTimezone } from './calendar';
import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { sendAndSaveOutbound } from '@/modules/messaging/send';
import { CALENDAR_CONNECTED_MESSAGE } from '@/modules/messaging/prompts';

function renderErrorPage(res: Response, title: string, body: string, status: number = statusCodes.BAD_REQUEST) {
  res
    .status(status)
    .type('html')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fafafa;
display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;padding:24px}
.c{max-width:440px}h1{font-size:24px;margin:0 0 12px;font-weight:700}p{color:#a3a3a3;line-height:1.5;margin:0}
</style></head><body><div class="c"><h1>${title}</h1><p>${body}</p></div></body></html>`,
    );
}

function webBase(): string {
  return env.CLIENT_URL.split(',')[0]!.trim().replace(/\/$/, '');
}

/**
 * GET /api/auth/google/start?t=<connectToken>
 * Verifies the one-time token, signs OAuth state, redirects to Google consent.
 */
export async function handleGoogleStart(req: Request, res: Response) {
  const token = typeof req.query.t === 'string' ? req.query.t : null;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    renderErrorPage(
      res,
      'Not configured',
      'Google OAuth is not set up on this server. Contact the operator.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  if (!token) {
    renderErrorPage(
      res,
      'Missing link',
      'This connect link is invalid. Text the assistant "connect" to get a fresh one.',
    );
    return;
  }

  const user = await findUserByConnectToken(token);
  if (!user) {
    renderErrorPage(
      res,
      'Link expired',
      'This connect link has expired or been used. Text the assistant "connect" to get a fresh one.',
    );
    return;
  }

  const state = signOAuthState(user.id);
  const url = buildConsentUrl(state);
  if (!url) {
    renderErrorPage(
      res,
      'Not configured',
      'Google OAuth is not configured correctly.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  res.redirect(url);
}

/**
 * GET /api/auth/google/callback?code=...&state=...
 * Exchanges code for tokens, persists against the user, texts them a confirmation,
 * redirects browser to /connect/success on the web frontend.
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const errorParam = typeof req.query.error === 'string' ? req.query.error : null;

  if (errorParam) {
    logger.warn('[google-oauth] User denied consent or flow errored', { errorParam });
    res.redirect(`${webBase()}/connect?denied=1`);
    return;
  }

  if (!code || !state) {
    renderErrorPage(res, 'Bad callback', 'Google sent us back with missing parameters.');
    return;
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    renderErrorPage(res, 'Link expired', 'Your sign-in attempt timed out. Text the assistant "connect" to try again.');
    return;
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens) {
    renderErrorPage(
      res,
      'Connect failed',
      'We could not exchange the authorization code with Google. Please try again.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  const existing = await db.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, phoneNumber: true, googleRefreshToken: true },
  });

  if (!existing) {
    renderErrorPage(res, 'Unknown account', 'We could not find your account. Text the assistant and try again.');
    return;
  }

  // Google only returns refresh_token on first consent (or with prompt=consent).
  // Preserve the existing refresh token if none came back in this round.
  const refreshTokenToStore = tokens.refreshToken ?? existing.googleRefreshToken;

  // Pull the owner's actual timezone from their Google Calendar — the authoritative answer.
  // Beats our area-code heuristic, which can be wrong if they moved.
  const googleTimezone = await fetchPrimaryCalendarTimezone(tokens.accessToken);

  await db.user.update({
    where: { id: existing.id },
    data: {
      googleEmail: tokens.email,
      googleRefreshToken: refreshTokenToStore,
      googleAccessToken: tokens.accessToken,
      googleAccessTokenExpiresAt: tokens.accessTokenExpiresAt,
      calendarConnectedAt: new Date(),
      contactsConnectedAt: new Date(),
      tasksConnectedAt: new Date(),
      connectToken: null,
      connectTokenExpiresAt: null,
      ...(googleTimezone ? { timezone: googleTimezone } : {}),
    },
  });

  if (googleTimezone) {
    logger.info('[google-oauth] Synced timezone from Google Calendar', {
      userId: existing.id,
      timezone: googleTimezone,
    });
  }

  if (existing.phoneNumber) {
    sendAndSaveOutbound(CALENDAR_CONNECTED_MESSAGE, existing.phoneNumber, existing.id).catch((err) =>
      logger.error('[google-oauth] Failed to send calendar-connected message', {
        userId: existing.id,
        error: err instanceof Error ? err.message : err,
      }),
    );
  }

  res.redirect(`${webBase()}/connect/success`);
}
