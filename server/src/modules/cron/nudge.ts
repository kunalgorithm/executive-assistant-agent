import cron from 'node-cron';

import { logger } from '@/utils/log';

// Nudges disabled until we have a proper strategy (messages aren't saved as ChannelMessage records).
// Previous implementation is preserved in git history.

export function startNudgeCron() {
  cron.schedule('*/30 * * * *', () => {
    logger.info('[nudge] Nudges are currently disabled — skipping');
  });

  logger.info('Nudge cron job started (every 30 minutes)');
}
