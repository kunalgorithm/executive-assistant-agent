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
import { renderIntegrationErrorPage } from '@/modules/integrations/http';
import { statusCodes } from '@/utils/http';
import { sendAndSaveOutbound } from '@/modules/messaging/send';
import { CALENDAR_CONNECTED_MESSAGE } from '@/modules/messaging/prompts';
import { upsertConnectedAccount } from '@/modules/integrations/accounts';

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
    renderIntegrationErrorPage(
      res,
      'Not configured',
      'Google OAuth is not set up on this server. Contact the operator.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  if (!token) {
    renderIntegrationErrorPage(
      res,
      'Missing link',
      'This connect link is invalid. Text the assistant "connect" to get a fresh one.',
    );
    return;
  }

  const user = await findUserByConnectToken(token);
  if (!user) {
    renderIntegrationErrorPage(
      res,
      'Link expired',
      'This connect link has expired or been used. Text the assistant "connect" to get a fresh one.',
    );
    return;
  }

  const state = signOAuthState(user.id);
  const url = buildConsentUrl(state);
  if (!url) {
    renderIntegrationErrorPage(
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
    renderIntegrationErrorPage(res, 'Bad callback', 'Google sent us back with missing parameters.');
    return;
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    renderIntegrationErrorPage(
      res,
      'Link expired',
      'Your sign-in attempt timed out. Text the assistant "connect" to try again.',
    );
    return;
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens) {
    renderIntegrationErrorPage(
      res,
      'Connect failed',
      'We could not exchange the authorization code with Google. Please try again.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  const existing = await db.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, phoneNumber: true, googleRefreshToken: true, googleEmail: true },
  });

  if (!existing) {
    renderIntegrationErrorPage(res, 'Unknown account', 'We could not find your account. Text the assistant and try again.');
    return;
  }

  // Google only returns refresh_token on first consent (or with prompt=consent).
  // Preserve the existing refresh token if none came back in this round.
  const refreshTokenToStore = tokens.refreshToken ?? existing.googleRefreshToken;
  const providerAccountId = tokens.providerAccountId ?? tokens.email ?? existing.googleEmail;
  if (!providerAccountId || !refreshTokenToStore) {
    renderIntegrationErrorPage(
      res,
      'Connect failed',
      'Google did not return enough account information. Please try again.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  // Pull the owner's actual timezone from their Google Calendar — the authoritative answer.
  // Beats our area-code heuristic, which can be wrong if they moved.
  const googleTimezone = await fetchPrimaryCalendarTimezone(tokens.accessToken);

  const connectedAt = new Date();

  await db.user.update({
    where: { id: existing.id },
    data: {
      googleEmail: tokens.email ?? existing.googleEmail,
      googleRefreshToken: refreshTokenToStore,
      googleAccessToken: tokens.accessToken,
      googleAccessTokenExpiresAt: tokens.accessTokenExpiresAt,
      calendarConnectedAt: connectedAt,
      contactsConnectedAt: connectedAt,
      tasksConnectedAt: connectedAt,
      gmailConnectedAt: connectedAt,
      connectToken: null,
      connectTokenExpiresAt: null,
      ...(googleTimezone ? { timezone: googleTimezone } : {}),
    },
  });

  await upsertConnectedAccount({
    userId: existing.id,
    provider: 'google',
    providerAccountId,
    email: tokens.email,
    displayName: tokens.displayName,
    scopes: tokens.scopes,
    refreshToken: refreshTokenToStore,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    calendarConnectedAt: connectedAt,
    contactsConnectedAt: connectedAt,
    tasksConnectedAt: connectedAt,
    emailConnectedAt: connectedAt,
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

  res.redirect(`${webBase()}/connect/success?provider=google`);
}
