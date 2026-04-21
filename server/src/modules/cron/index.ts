import cron from 'node-cron';

import { logger } from '@/utils/log';
import { withCronLock } from '@/utils/locks';
import {
  claimDueReminders,
  completeReminderDelivery,
  failReminderDelivery,
  type DueReminderRecord,
} from '@/modules/reminders/reminders';
import { buildReminderDeliveryMessage } from '@/modules/reminders/delivery';
import { sendAndSaveOutbound } from '@/modules/messaging/send';

const REMINDER_DISPATCH_CRON = '*/1 * * * *';

async function processDueReminder(reminder: DueReminderRecord) {
  const toNumber = reminder.user.phoneNumber;
  if (!toNumber) {
    await failReminderDelivery(reminder, 'missing_phone_number');
    return;
  }

  try {
    const content = buildReminderDeliveryMessage(reminder);
    await sendAndSaveOutbound(content, toNumber, reminder.userId, undefined, { throwOnError: true });
    await completeReminderDelivery(reminder);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown_delivery_error';
    await failReminderDelivery(reminder, reason);
    logger.warn('[cron] Failed to deliver reminder', { reminderId: reminder.id, userId: reminder.userId, reason });
  }
}

async function runReminderDispatchJob() {
  const dueReminders = await claimDueReminders(new Date());
  if (dueReminders.length === 0) return;

  logger.info('[cron] Processing due reminders', { count: dueReminders.length });
  for (const reminder of dueReminders) {
    await processDueReminder(reminder);
  }
}

export function startCronJobs() {
  cron.schedule(
    REMINDER_DISPATCH_CRON,
    withCronLock('dispatch-reminders', runReminderDispatchJob, {
      onError: (error) => {
        logger.error('[cron] Reminder dispatch job failed', { error: error instanceof Error ? error.message : error });
      },
    }),
  );

  logger.info('[cron] Registered jobs', { reminders: REMINDER_DISPATCH_CRON });
}
