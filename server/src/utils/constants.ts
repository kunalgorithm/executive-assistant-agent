import { env } from '@/utils/env';

export const SENDBLUE_STATUS_MAP: Record<string, string> = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  ERROR: 'failed',
  UNDELIVERED: 'undelivered',
};

export const GEMINI_FLASH3_MODEL = 'gemini-3-flash-preview';

export const WEBHOOK_STATUS_CALLBACK_URL = `${env.SENDBLUE_WEBHOOK_BASE_URL}/api/messaging/webhook/status`;
