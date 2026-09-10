import { Router } from 'express';

import { asyncRoute } from '@/utils/error';
import { statusCodes } from '@/utils/http';
import { findUserByConnectToken } from '@/modules/google/oauth';
import { getConnectedAccounts } from './accounts';
import { env } from '@/utils/env';
import { createConnectPageHandler } from './connect';

const integrationsRouter: Router = Router();
const accountConnectionRouter: Router = Router();

accountConnectionRouter.get(
  '/',
  asyncRoute(
    createConnectPageHandler({
      findUserByToken: findUserByConnectToken,
      googleEnabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
      microsoftEnabled: !!env.MICROSOFT_CLIENT_ID && !!env.MICROSOFT_CLIENT_SECRET,
    }),
  ),
);

integrationsRouter.get(
  '/accounts',
  asyncRoute(async (req, res) => {
    const token = typeof req.query.t === 'string' ? req.query.t : null;
    if (!token) {
      res.status(statusCodes.BAD_REQUEST).json({ data: null, errors: { token: 'Missing connect token' } });
      return;
    }

    const user = await findUserByConnectToken(token);
    if (!user) {
      res.status(statusCodes.NOT_FOUND).json({ data: null, errors: { token: 'Invalid or expired connect token' } });
      return;
    }

    const accounts = await getConnectedAccounts(user.id);
    res.json({ data: { accounts }, errors: null });
  }),
);

export { integrationsRouter, accountConnectionRouter };
