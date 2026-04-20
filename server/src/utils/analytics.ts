import type { Prisma } from '@/generated/prisma/client';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';

export const ANALYTICS_EVENTS = {
  phone_linked: 'phone_linked',
  user_created_via_sms: 'user_created_via_sms',
  user_reset: 'user_reset',
  user_stopped: 'user_stopped',
  user_opted_in: 'user_opted_in',
  user_declined_intro: 'user_declined_intro',
  onboarding_complete: 'onboarding_complete',
  match_created: 'match_created',
  match_notified: 'match_notified',
  introduction_drafts_generated: 'introduction_drafts_generated',
  opt_in_sent: 'opt_in_sent',
  group_introduction_sent: 'group_introduction_sent',
  nudge_sent: 'nudge_sent',
  checkin_sent: 'checkin_sent',
  admin_opt_in_toggled: 'admin_opt_in_toggled',
  contact_card_sent: 'contact_card_sent',
  admin_notes_updated: 'admin_notes_updated',
  no_match_reassurance_sent: 'no_match_reassurance_sent',
  onboarding_substatus_changed: 'onboarding_substatus_changed',
  profile_extraction_completed: 'profile_extraction_completed',
  inbound_message_received: 'inbound_message_received',

  ai_response_failed: 'ai_response_failed',
  match_ready: 'match_ready',
  user_profile_reset: 'user_profile_reset',

  matches_suggested: 'matches_suggested',
  match_approved: 'match_approved',
  match_rejected: 'match_rejected',
  batch_matching_complete: 'batch_matching_complete',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export function trackEvent(event: AnalyticsEvent, userId?: string, metadata?: Prisma.InputJsonValue) {
  db.analyticsEvent
    .create({ data: { event, userId, metadata: metadata ?? undefined } })
    .catch((err) => logger.warn('Analytics event failed', { event, error: (err as Error).message }));
}
