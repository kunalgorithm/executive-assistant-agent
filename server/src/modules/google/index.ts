import { Router } from 'express';

import { asyncRoute } from '@/utils/error';
import { handleGoogleStart, handleGoogleCallback } from './handlers';

const googleAuthRouter: Router = Router();

googleAuthRouter.get('/start', asyncRoute(handleGoogleStart));
googleAuthRouter.get('/callback', asyncRoute(handleGoogleCallback));

export { googleAuthRouter };
