import { Router } from 'express';

import { handleListUsers, handleGetDirectConversation } from './handlers/admin';
import { asyncRoute } from '@/utils/error';
import { requireAdmin } from './middleware';
import { adminLimiter } from '@/utils/rateLimit';
import { handleUpdateAdminNotes } from './handlers/utility';
import { handleGetDistinctEvents, handleListAnalyticsEvents } from './handlers/events';

const adminRouter: Router = Router();

adminRouter.use(adminLimiter);

adminRouter.get('/users', requireAdmin, asyncRoute(handleListUsers));
adminRouter.get('/users/:userId/messages', requireAdmin, asyncRoute(handleGetDirectConversation));
adminRouter.put('/users/:userId/notes', requireAdmin, asyncRoute(handleUpdateAdminNotes));

adminRouter.get('/events', requireAdmin, asyncRoute(handleListAnalyticsEvents));
adminRouter.get('/event-types', requireAdmin, asyncRoute(handleGetDistinctEvents));

export { adminRouter };
