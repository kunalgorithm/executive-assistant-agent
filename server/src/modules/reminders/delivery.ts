import { ReminderCategory, ReminderRecurrence } from '@/generated/prisma/client';
import type { DueReminderRecord } from './reminders';

function categoryPrefix(category: ReminderCategory): string {
  switch (category) {
    case ReminderCategory.birthday:
      return 'birthday reminder';
    case ReminderCategory.event:
      return 'event reminder';
    case ReminderCategory.conflict:
      return 'conflict reminder';
    case ReminderCategory.busy_time:
      return 'busy-time reminder';
    case ReminderCategory.general:
    default:
      return 'reminder';
  }
}

function recurrenceSuffix(recurrence: ReminderRecurrence, interval: number): string {
  if (recurrence === ReminderRecurrence.none) return '';

  const value = Math.max(1, interval);
  if (value === 1) return recurrence === ReminderRecurrence.yearly ? ' (recurs yearly)' : ` (recurs ${recurrence})`;
  return ` (recurs every ${value} ${recurrence}s)`;
}

function formatDueTime(remindAt: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(remindAt);
  } catch {
    return remindAt.toISOString();
  }
}

export function buildReminderDeliveryMessage(reminder: DueReminderRecord): string {
  const prefix = categoryPrefix(reminder.category);
  const dueText = formatDueTime(reminder.remindAt, reminder.timezone);
  const recurrence = recurrenceSuffix(reminder.recurrence, reminder.interval);
  const header = `⏰ ${prefix}: ${reminder.title}`;
  const dueLine = `scheduled for ${dueText}${recurrence}`;
  const noteLine = reminder.note ? `note: ${reminder.note}` : null;
  return [header, dueLine, noteLine].filter(Boolean).join('\n');
}
