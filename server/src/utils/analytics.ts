import type { Prisma } from '@/generated/prisma/client';

import { db } from '@/utils/db';
import { logger } from '@/utils/log';

export const ANALYTICS_EVENTS = {
  user_created_via_sms: 'user_created_via_sms',
  inbound_message_received: 'inbound_message_received',
  ai_response_failed: 'ai_response_failed',
  admin_notes_updated: 'admin_notes_updated',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export function trackEvent(event: AnalyticsEvent, userId?: string, metadata?: Prisma.InputJsonValue) {
  db.analyticsEvent
    .create({ data: { event, userId, metadata: metadata ?? undefined } })
    .catch((err) => logger.warn('Analytics event failed', { event, error: (err as Error).message }));
}
