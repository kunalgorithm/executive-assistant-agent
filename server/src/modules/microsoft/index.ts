import { Router } from 'express';

import { asyncRoute } from '@/utils/error';
import { handleMicrosoftCallback, handleMicrosoftStart } from './handlers';

const microsoftAuthRouter: Router = Router();

microsoftAuthRouter.get('/start', asyncRoute(handleMicrosoftStart));
microsoftAuthRouter.get('/callback', asyncRoute(handleMicrosoftCallback));

export { microsoftAuthRouter };
