import type { Request, Response } from 'express';

import { db } from '@/utils/db';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';
import { statusCodes } from '@/utils/http';
import { sendAndSaveOutbound } from '@/modules/messaging/send';
import { CALENDAR_CONNECTED_MESSAGE } from '@/modules/messaging/prompts';
import { upsertConnectedAccount } from '@/modules/integrations/accounts';
import { renderIntegrationErrorPage } from '@/modules/integrations/http';
import { fetchMicrosoftPrimaryCalendarTimezone } from './calendar';
import {
  buildMicrosoftConsentUrl,
  exchangeMicrosoftCodeForTokens,
  microsoftOAuthConfigured,
  signMicrosoftOAuthState,
  verifyMicrosoftOAuthState,
} from './oauth';
import { findUserByConnectToken } from '@/modules/google/oauth';

function webBase(): string {
  return env.CLIENT_URL.split(',')[0]!.trim().replace(/\/$/, '');
}

export async function handleMicrosoftStart(req: Request, res: Response) {
  const token = typeof req.query.t === 'string' ? req.query.t : null;

  if (!microsoftOAuthConfigured()) {
    renderIntegrationErrorPage(
      res,
      'Not configured',
      'Microsoft OAuth is not set up on this server. Contact the operator.',
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

  const url = buildMicrosoftConsentUrl(signMicrosoftOAuthState(user.id));
  if (!url) {
    renderIntegrationErrorPage(
      res,
      'Not configured',
      'Microsoft OAuth is not configured correctly.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  res.redirect(url);
}

export async function handleMicrosoftCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const errorParam = typeof req.query.error === 'string' ? req.query.error : null;

  if (errorParam) {
    logger.warn('[microsoft-oauth] User denied consent or flow errored', { errorParam });
    res.redirect(`${webBase()}/connect?denied=1&provider=microsoft`);
    return;
  }

  if (!code || !state) {
    renderIntegrationErrorPage(res, 'Bad callback', 'Microsoft sent us back with missing parameters.');
    return;
  }

  const verified = verifyMicrosoftOAuthState(state);
  if (!verified) {
    renderIntegrationErrorPage(
      res,
      'Link expired',
      'Your sign-in attempt timed out. Text the assistant "connect" to try again.',
    );
    return;
  }

  const tokens = await exchangeMicrosoftCodeForTokens(code);
  if (!tokens?.refreshToken) {
    renderIntegrationErrorPage(
      res,
      'Connect failed',
      'We could not exchange the authorization code with Microsoft. Please try again.',
      statusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }

  const existing = await db.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, phoneNumber: true },
  });

  if (!existing) {
    renderIntegrationErrorPage(res, 'Unknown account', 'We could not find your account. Text the assistant and try again.');
    return;
  }

  const microsoftTimezone = await fetchMicrosoftPrimaryCalendarTimezone(tokens.accessToken);

  await upsertConnectedAccount({
    userId: existing.id,
    provider: 'microsoft',
    providerAccountId: tokens.providerAccountId,
    email: tokens.email,
    displayName: tokens.displayName,
    scopes: tokens.scopes,
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  });

  await db.user.update({
    where: { id: existing.id },
    data: {
      connectToken: null,
      connectTokenExpiresAt: null,
      calendarConnectedAt: new Date(),
      contactsConnectedAt: new Date(),
      tasksConnectedAt: new Date(),
      gmailConnectedAt: new Date(),
      ...(microsoftTimezone ? { timezone: microsoftTimezone } : {}),
    },
  });

  if (microsoftTimezone) {
    logger.info('[microsoft-oauth] Synced timezone from Microsoft Calendar', {
      userId: existing.id,
      timezone: microsoftTimezone,
    });
  }

  if (existing.phoneNumber) {
    sendAndSaveOutbound(CALENDAR_CONNECTED_MESSAGE, existing.phoneNumber, existing.id).catch((err) =>
      logger.error('[microsoft-oauth] Failed to send connected message', {
        userId: existing.id,
        error: err instanceof Error ? err.message : err,
      }),
    );
  }

  res.redirect(`${webBase()}/connect/success?provider=microsoft`);
}
