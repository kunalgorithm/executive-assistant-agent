import cron from 'node-cron';

import { logger } from '@/utils/log';
import { withCronLock } from '@/utils/locks';
import { runBatchMatching } from '@/modules/matching/algorithm';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';

async function batchMatchingCronTask() {
  const result = await runBatchMatching();
  logger.info('[matching] Batch matching cron complete', { created: result.created });
  trackEvent(ANALYTICS_EVENTS.batch_matching_complete, undefined, { created: result.created });
}

export function startMatchingCron() {
  // Run every 6 hours — discovers new matches for users who may have been missed
  cron.schedule(
    '0 */6 * * *',
    withCronLock('batch-matching', batchMatchingCronTask, {
      onError: (error) => {
        logger.error('[matching] Batch matching cron failed', {
          error: error instanceof Error ? error.message : error,
        });
      },
    }),
  );

  logger.info('[matching] Batch matching cron job started (every 6 hours)');
}
