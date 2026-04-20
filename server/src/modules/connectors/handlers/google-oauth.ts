import { z } from 'zod';
import type { Request, Response } from 'express';

import { getZodErrors } from '@/utils/error';
import { statusCodes } from '@/utils/http';
import { logger } from '@/utils/log';
import { createConnectorOAuthStateToken, parseConnectorOAuthStateToken } from '@/modules/connectors/oauth-state';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
} from '@/modules/connectors/providers/google/oauth';
import { googleConnectorScopes } from '@/modules/connectors/providers/google/scopes';
import { upsertConnectedAccount } from '@/modules/connectors/service';

const googleOAuthStartQuerySchema = z.object({
  userId: z.string().uuid(),
  mode: z.enum(['json', 'redirect']).default('json'),
  returnTo: z.string().url().optional(),
});

const googleOAuthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export function handleGoogleOAuthStart(req: Request, res: Response) {
  const { data, errors } = getZodErrors(googleOAuthStartQuerySchema, req.query);

  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  try {
    const state = createConnectorOAuthStateToken({
      userId: data.userId,
      provider: 'GOOGLE',
      returnTo: data.returnTo,
      issuedAt: new Date().toISOString(),
    });
    const authorizationUrl = buildGoogleAuthorizationUrl(state);

    if (data.mode === 'redirect') {
      res.redirect(authorizationUrl);
      return;
    }

    res.status(statusCodes.OK).json({
      data: {
        provider: 'GOOGLE',
        authorizationUrl,
        scopes: [...googleConnectorScopes],
      },
      errors: null,
    });
  } catch (error) {
    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: {
        message: error instanceof Error ? error.message : 'Could not start Google OAuth',
      },
    });
  }
}

export async function handleGoogleOAuthCallback(req: Request, res: Response) {
  const { data, errors } = getZodErrors(googleOAuthCallbackQuerySchema, req.query);

  if (errors || !data) {
    res.status(statusCodes.BAD_REQUEST).json({ data: null, errors });
    return;
  }

  if (data.error) {
    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: {
        message: data.error_description ?? data.error,
      },
    });
    return;
  }

  if (!data.code || !data.state) {
    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: {
        message: 'Missing Google OAuth code or state',
      },
    });
    return;
  }

  try {
    const state = parseConnectorOAuthStateToken(data.state);
    const tokenResponse = await exchangeGoogleAuthorizationCode(data.code);
    const profile = await fetchGoogleUserInfo(tokenResponse.access_token);

    const account = await upsertConnectedAccount({
      userId: state.userId,
      provider: 'GOOGLE',
      externalAccountId: profile.sub,
      accountEmail: profile.email ?? null,
      accountName: profile.name ?? profile.given_name ?? null,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      idToken: tokenResponse.id_token ?? null,
      tokenType: tokenResponse.token_type,
      scopes: tokenResponse.scope.split(' ').filter(Boolean),
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      metadata: {
        emailVerified: profile.email_verified ?? null,
        familyName: profile.family_name ?? null,
        givenName: profile.given_name ?? null,
        locale: profile.locale ?? null,
        picture: profile.picture ?? null,
      },
    });

    res.status(statusCodes.OK).json({
      data: {
        account,
        returnTo: state.returnTo ?? null,
      },
      errors: null,
    });
  } catch (error) {
    logger.error('[connectors] Google OAuth callback failed', {
      error: error instanceof Error ? error.message : error,
    });

    res.status(statusCodes.BAD_REQUEST).json({
      data: null,
      errors: {
        message: error instanceof Error ? error.message : 'Could not complete Google OAuth',
      },
    });
  }
}
