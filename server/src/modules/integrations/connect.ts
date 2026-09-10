import type { Request, Response } from 'express';
import { renderIntegrationCancelledPage, renderIntegrationErrorPage, renderIntegrationPage } from './http';

type Dependencies = {
  findUserByToken: (token: string) => Promise<{ id: string } | null>;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
};

export function createConnectPageHandler({ findUserByToken, googleEnabled, microsoftEnabled }: Dependencies) {
  return async (req: Request, res: Response) => {
    if (req.query.denied === '1') {
      renderIntegrationCancelledPage(res);
      return;
    }
    const token = typeof req.query.t === 'string' ? req.query.t : null;
    if (!token) {
      renderIntegrationErrorPage(
        res,
        'Get a connection link',
        'Text “connect” to Sayla when you want to link a Google or Microsoft account.',
      );
      return;
    }
    const user = await findUserByToken(token);
    if (!user) {
      renderIntegrationErrorPage(
        res,
        'This link has expired',
        'Text “connect” for a fresh link. You can keep texting Sayla without connecting an account.',
        410,
      );
      return;
    }
    if (!googleEnabled && !microsoftEnabled) {
      renderIntegrationErrorPage(
        res,
        'Connection temporarily unavailable',
        'Please try again later. You can still text Sayla for reminders and general help.',
        503,
      );
      return;
    }
    const query = new URLSearchParams({ t: token }).toString();
    renderIntegrationPage(res, {
      title: 'Connect your account',
      body: 'Choose an account to give Sayla access to your calendar, email, contacts, and tasks. You’ll review permissions with your provider next.',
      details: [
        'Read and manage calendar events and tasks',
        'Read email and contacts',
        'You can revoke access in your provider’s settings',
      ],
      actions: [
        ...(googleEnabled ? [{ label: 'Connect Google', href: `/api/auth/google/start?${query}` }] : []),
        ...(microsoftEnabled ? [{ label: 'Connect Microsoft', href: `/api/auth/microsoft/start?${query}` }] : []),
      ],
    });
  };
}
