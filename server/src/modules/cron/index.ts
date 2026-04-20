import { logger } from '@/utils/log';
import { db } from '@/utils/db';
import { runConsolidation } from '@/modules/memory/consolidator';

// Run consolidation nightly at 3am UTC
const CONSOLIDATION_HOUR_UTC = 3;

export function startCronJobs() {
  scheduleNightlyConsolidation();
  logger.info('[cron] Registered nightly memory consolidation');
}

function scheduleNightlyConsolidation() {
  const msUntilNextRun = msUntilNextHourUTC(CONSOLIDATION_HOUR_UTC);

  setTimeout(async () => {
    await runNightlyConsolidation();
    // Re-schedule for the following day
    setInterval(runNightlyConsolidation, 24 * 60 * 60 * 1000);
  }, msUntilNextRun);

  logger.info('[cron] Memory consolidation scheduled', {
    nextRunIn: `${Math.round(msUntilNextRun / 1000 / 60)} minutes`,
  });
}

async function runNightlyConsolidation() {
  logger.info('[cron] Starting nightly memory consolidation');

  try {
    const activeUsers = await db.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const user of activeUsers) {
      await runConsolidation(user.id);
    }

    logger.info('[cron] Nightly consolidation complete', { usersProcessed: activeUsers.length });
  } catch (error) {
    logger.error('[cron] Nightly consolidation failed', {
      error: error instanceof Error ? error.message : error,
    });
  }
}

function msUntilNextHourUTC(targetHour: number): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHour, 0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}
