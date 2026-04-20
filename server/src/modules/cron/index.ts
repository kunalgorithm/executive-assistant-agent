import { startMatchingCron } from './matching';
import { startNotificationCron } from './notifications';

export function startCronJobs() {
  startMatchingCron();
  startNotificationCron();
}
