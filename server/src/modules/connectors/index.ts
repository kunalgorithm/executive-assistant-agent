import { Router } from 'express';

import { asyncRoute } from '@/utils/error';
import { handleConnectorCatalog } from '@/modules/connectors/handlers/catalog';
import { handleListConnectedAccounts } from '@/modules/connectors/handlers/accounts';
import { handleGoogleOAuthCallback, handleGoogleOAuthStart } from '@/modules/connectors/handlers/google-oauth';

const connectorsRouter: Router = Router();

connectorsRouter.get('/catalog', handleConnectorCatalog);
connectorsRouter.get('/accounts', asyncRoute(handleListConnectedAccounts));
connectorsRouter.get('/google/start', handleGoogleOAuthStart);
connectorsRouter.get('/google/callback', asyncRoute(handleGoogleOAuthCallback));

export { connectorsRouter };
