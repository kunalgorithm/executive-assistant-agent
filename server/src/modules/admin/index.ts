import { Router } from 'express';

import {
  handleListUsers,
  handleUpdateDrafts,
  handleGetDirectConversation,
  handleGetGroupConversation,
} from './handlers/admin';
import {
  handleBackfillMatchReasons,
  handleBackfillPrimaryIntent,
  handleBackfillProfileCompletion,
} from './handlers/backfills';
import { asyncRoute } from '@/utils/error';
import { requireAdmin } from './middleware';
import { adminLimiter, adminHeavyLimiter } from '@/utils/rateLimit';
import { handleSendOptIn, handleToggleOptIn } from './handlers/optIn';
import { handleSendContactCard, handleUpdateAdminNotes } from './handlers/utility';
import { handleGetDistinctEvents, handleListAnalyticsEvents } from './handlers/events';
import { handleStartIntroduction, handleSendGroupIntro, handleCompatibilityCheck } from './handlers/introduction';
import { handleListMatches, handleApproveMatch, handleRejectMatch, handleRefreshUserMatches } from './handlers/matches';

const adminRouter: Router = Router();

adminRouter.use(adminLimiter);

adminRouter.get('/users', requireAdmin, asyncRoute(handleListUsers));
adminRouter.get('/users/:userId/messages', requireAdmin, asyncRoute(handleGetDirectConversation));
adminRouter.get('/matches/:matchId/messages', requireAdmin, asyncRoute(handleGetGroupConversation));
adminRouter.put('/introduce/:matchId/drafts', requireAdmin, asyncRoute(handleUpdateDrafts));
adminRouter.post('/introduce/:matchId/send-opt-in', requireAdmin, asyncRoute(handleSendOptIn));
adminRouter.post('/introduce/:matchId/toggle-opt-in', requireAdmin, asyncRoute(handleToggleOptIn));
adminRouter.post('/introduce/:matchId/send-group', requireAdmin, asyncRoute(handleSendGroupIntro));
adminRouter.post('/users/:userId/send-contact-card', requireAdmin, asyncRoute(handleSendContactCard));
adminRouter.put('/users/:userId/notes', requireAdmin, asyncRoute(handleUpdateAdminNotes));

adminRouter.get('/matches', requireAdmin, asyncRoute(handleListMatches));
adminRouter.post('/matches/:matchId/reject', requireAdmin, asyncRoute(handleRejectMatch));

adminRouter.get('/events', requireAdmin, asyncRoute(handleListAnalyticsEvents));
adminRouter.get('/event-types', requireAdmin, asyncRoute(handleGetDistinctEvents));

// Heavy operations — stricter rate limit (trigger AI calls, embeddings, batch processing)
adminRouter.post('/introduce/check', adminHeavyLimiter, requireAdmin, asyncRoute(handleCompatibilityCheck));
adminRouter.post('/introduce/start', adminHeavyLimiter, requireAdmin, asyncRoute(handleStartIntroduction));
adminRouter.post('/matches/:matchId/approve', adminHeavyLimiter, requireAdmin, asyncRoute(handleApproveMatch));
adminRouter.post('/matching/refresh/:userId', adminHeavyLimiter, requireAdmin, asyncRoute(handleRefreshUserMatches));
adminRouter.post('/backfill/primary-intent', adminHeavyLimiter, requireAdmin, asyncRoute(handleBackfillPrimaryIntent));
adminRouter.post(
  '/backfill/profile-completion',
  adminHeavyLimiter,
  requireAdmin,
  asyncRoute(handleBackfillProfileCompletion),
);
adminRouter.post('/backfill/match-reasons', adminHeavyLimiter, requireAdmin, asyncRoute(handleBackfillMatchReasons));

export { adminRouter };
