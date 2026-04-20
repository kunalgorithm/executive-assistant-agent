import { ReminderCategory, ReminderRecurrence, ReminderStatus } from '@/generated/prisma/client';
import { db } from '@/utils/db';
import { logger } from '@/utils/log';
import { ANALYTICS_EVENTS, trackEvent } from '@/utils/analytics';

type ReminderCategoryInput = 'general' | 'birthday' | 'event' | 'conflict' | 'busy_time';
type ReminderStatusInput = 'scheduled' | 'processing' | 'completed' | 'cancelled';
type ReminderRecurrenceInput = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

type ReminderSummary = {
  id: string;
  title: string;
  note: string | null;
  category: ReminderCategoryInput;
  status: ReminderStatusInput;
  recurrence: ReminderRecurrenceInput;
  interval: number;
  remindAt: string;
  timezone: string;
  lastSentAt: string | null;
};

function toReminderCategory(category?: string): ReminderCategory {
  const normalized = category?.trim().toLowerCase();
  switch (normalized) {
    case 'birthday':
      return ReminderCategory.birthday;
    case 'event':
      return ReminderCategory.event;
    case 'conflict':
      return ReminderCategory.conflict;
    case 'busy_time':
      return ReminderCategory.busy_time;
    default:
      return ReminderCategory.general;
  }
}

function toReminderRecurrence(recurrence?: string): ReminderRecurrence {
  const normalized = recurrence?.trim().toLowerCase();
  switch (normalized) {
    case 'daily':
      return ReminderRecurrence.daily;
    case 'weekly':
      return ReminderRecurrence.weekly;
    case 'monthly':
      return ReminderRecurrence.monthly;
    case 'yearly':
      return ReminderRecurrence.yearly;
    default:
      return ReminderRecurrence.none;
  }
}

function toReminderSummary(reminder: {
  id: string;
  title: string;
  note: string | null;
  category: ReminderCategory;
  status: ReminderStatus;
  recurrence: ReminderRecurrence;
  interval: number;
  remindAt: Date;
  timezone: string;
  lastSentAt: Date | null;
}): ReminderSummary {
  return {
    id: reminder.id,
    title: reminder.title,
    note: reminder.note,
    category: reminder.category,
    status: reminder.status,
    recurrence: reminder.recurrence,
    interval: reminder.interval,
    remindAt: reminder.remindAt.toISOString(),
    timezone: reminder.timezone,
    lastSentAt: reminder.lastSentAt ? reminder.lastSentAt.toISOString() : null,
  };
}

function parseIsoDateTime(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function positiveInterval(value?: number): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function addRecurringInterval(base: Date, recurrence: ReminderRecurrence, interval: number): Date {
  const next = new Date(base);
  switch (recurrence) {
    case ReminderRecurrence.daily:
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    case ReminderRecurrence.weekly:
      next.setUTCDate(next.getUTCDate() + interval * 7);
      return next;
    case ReminderRecurrence.monthly:
      next.setUTCMonth(next.getUTCMonth() + interval);
      return next;
    case ReminderRecurrence.yearly:
      next.setUTCFullYear(next.getUTCFullYear() + interval);
      return next;
    case ReminderRecurrence.none:
    default:
      return next;
  }
}

function nextReminderTime(remindAt: Date, recurrence: ReminderRecurrence, interval: number): Date | null {
  if (recurrence === ReminderRecurrence.none) return null;
  const effectiveInterval = positiveInterval(interval);
  let candidate = new Date(remindAt);
  const now = new Date();
  // Guard against stale reminders by advancing until we reach the future.
  for (let i = 0; i < 1000; i++) {
    candidate = addRecurringInterval(candidate, recurrence, effectiveInterval);
    if (candidate > now) return candidate;
  }
  logger.warn('[reminders] Failed to compute next recurring reminder within max iterations', {
    remindAt: remindAt.toISOString(),
    recurrence,
    interval: effectiveInterval,
  });
  return null;
}

export type CreateReminderArgs = {
  title: string;
  remindAt: string;
  note?: string;
  category?: ReminderCategoryInput;
  recurrence?: ReminderRecurrenceInput;
  interval?: number;
  timezone?: string;
};

export async function createReminder(userId: string, userTimezone: string, args: CreateReminderArgs) {
  const parsedRemindAt = parseIsoDateTime(args.remindAt);
  if (!parsedRemindAt) return { ok: false as const, error: 'invalid_remind_at' };

  const title = args.title.trim();
  if (title.length === 0) return { ok: false as const, error: 'empty_title' };

  const reminder = await db.reminder.create({
    data: {
      userId,
      title,
      note: args.note?.trim() || null,
      category: toReminderCategory(args.category),
      recurrence: toReminderRecurrence(args.recurrence),
      interval: positiveInterval(args.interval),
      remindAt: parsedRemindAt,
      timezone: args.timezone?.trim() || userTimezone,
      status: ReminderStatus.scheduled,
      cancelledAt: null,
    },
  });

  trackEvent(ANALYTICS_EVENTS.reminder_created, userId, {
    reminderId: reminder.id,
    category: reminder.category,
    recurrence: reminder.recurrence,
    remindAt: reminder.remindAt.toISOString(),
  });

  return { ok: true as const, reminder: toReminderSummary(reminder) };
}

export type ListRemindersArgs = {
  status?: ReminderStatusInput;
  category?: ReminderCategoryInput;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listReminders(userId: string, args: ListRemindersArgs) {
  const from = args.from ? parseIsoDateTime(args.from) : null;
  const to = args.to ? parseIsoDateTime(args.to) : null;
  if (args.from && !from) return { ok: false as const, error: 'invalid_from' };
  if (args.to && !to) return { ok: false as const, error: 'invalid_to' };

  const status = args.status ? (args.status as ReminderStatus) : undefined;
  const category = args.category ? toReminderCategory(args.category) : undefined;
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 50);

  const reminders = await db.reminder.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(from || to
        ? {
            remindAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ remindAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  return {
    ok: true as const,
    reminders: reminders.map(toReminderSummary),
  };
}

export type UpdateReminderArgs = {
  reminderId: string;
  title?: string;
  note?: string;
  remindAt?: string;
  category?: ReminderCategoryInput;
  recurrence?: ReminderRecurrenceInput;
  interval?: number;
  timezone?: string;
  status?: ReminderStatusInput;
};

export async function updateReminder(userId: string, args: UpdateReminderArgs) {
  const existing = await db.reminder.findFirst({
    where: { id: args.reminderId, userId },
  });
  if (!existing) return { ok: false as const, error: 'not_found' };

  const remindAt = args.remindAt ? parseIsoDateTime(args.remindAt) : undefined;
  if (args.remindAt && !remindAt) return { ok: false as const, error: 'invalid_remind_at' };

  const title = args.title?.trim();
  if (title !== undefined && title.length === 0) return { ok: false as const, error: 'empty_title' };

  const status = args.status ? (args.status as ReminderStatus) : undefined;
  const updated = await db.reminder.update({
    where: { id: existing.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(args.note !== undefined ? { note: args.note.trim() || null } : {}),
      ...(remindAt ? { remindAt } : {}),
      ...(args.category !== undefined ? { category: toReminderCategory(args.category) } : {}),
      ...(args.recurrence !== undefined ? { recurrence: toReminderRecurrence(args.recurrence) } : {}),
      ...(args.interval !== undefined ? { interval: positiveInterval(args.interval) } : {}),
      ...(args.timezone !== undefined ? { timezone: args.timezone.trim() || existing.timezone } : {}),
      ...(status !== undefined
        ? {
            status,
            cancelledAt: status === ReminderStatus.cancelled ? new Date() : null,
          }
        : {}),
    },
  });

  trackEvent(ANALYTICS_EVENTS.reminder_updated, userId, {
    reminderId: updated.id,
    status: updated.status,
    category: updated.category,
    recurrence: updated.recurrence,
    remindAt: updated.remindAt.toISOString(),
  });

  return { ok: true as const, reminder: toReminderSummary(updated) };
}

export type CancelReminderArgs = {
  reminderId: string;
};

export async function cancelReminder(userId: string, args: CancelReminderArgs) {
  const existing = await db.reminder.findFirst({
    where: { id: args.reminderId, userId },
  });
  if (!existing) return { ok: false as const, error: 'not_found' };

  const updated = await db.reminder.update({
    where: { id: existing.id },
    data: { status: ReminderStatus.cancelled, cancelledAt: new Date() },
  });

  trackEvent(ANALYTICS_EVENTS.reminder_cancelled, userId, { reminderId: updated.id });

  return { ok: true as const, reminder: toReminderSummary(updated) };
}

export type DueReminderRecord = {
  id: string;
  userId: string;
  title: string;
  note: string | null;
  category: ReminderCategory;
  recurrence: ReminderRecurrence;
  interval: number;
  remindAt: Date;
  timezone: string;
  user: {
    id: string;
    isActive: boolean;
    phoneNumber: string | null;
  };
};

const DUE_REMINDER_BATCH_SIZE = 50;
const FAILED_REMINDER_MAX_RETRIES = 3;

export async function claimDueReminders(now: Date = new Date()): Promise<DueReminderRecord[]> {
  const candidates = await db.reminder.findMany({
    where: {
      status: ReminderStatus.scheduled,
      remindAt: { lte: now },
      user: { isActive: true },
    },
    orderBy: [{ remindAt: 'asc' }, { createdAt: 'asc' }],
    take: DUE_REMINDER_BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      title: true,
      note: true,
      category: true,
      recurrence: true,
      interval: true,
      remindAt: true,
      timezone: true,
      user: {
        select: {
          id: true,
          isActive: true,
          phoneNumber: true,
        },
      },
    },
  });

  const claimed: DueReminderRecord[] = [];
  for (const reminder of candidates) {
    const updated = await db.reminder.updateMany({
      where: { id: reminder.id, status: ReminderStatus.scheduled },
      data: { status: ReminderStatus.processing },
    });
    if (updated.count === 1) {
      claimed.push(reminder);
    }
  }

  return claimed;
}

export async function completeReminderDelivery(reminder: DueReminderRecord) {
  const nextAt = nextReminderTime(reminder.remindAt, reminder.recurrence, reminder.interval);
  const updated = await db.reminder.update({
    where: { id: reminder.id },
    data: {
      status: nextAt ? ReminderStatus.scheduled : ReminderStatus.completed,
      remindAt: nextAt ?? reminder.remindAt,
      lastSentAt: new Date(),
      failedCount: 0,
      lastError: null,
    },
  });

  trackEvent(ANALYTICS_EVENTS.reminder_sent, reminder.userId, {
    reminderId: reminder.id,
    category: reminder.category,
    recurrence: reminder.recurrence,
    nextRemindAt: nextAt ? nextAt.toISOString() : null,
    status: updated.status,
  });
}

export async function failReminderDelivery(reminder: DueReminderRecord, reason: string) {
  const current = await db.reminder.findUnique({
    where: { id: reminder.id },
    select: { failedCount: true },
  });
  const failedCount = (current?.failedCount ?? 0) + 1;
  const exhausted = failedCount >= FAILED_REMINDER_MAX_RETRIES;
  await db.reminder.update({
    where: { id: reminder.id },
    data: {
      status: exhausted ? ReminderStatus.cancelled : ReminderStatus.scheduled,
      failedCount,
      lastError: reason,
      cancelledAt: exhausted ? new Date() : null,
    },
  });
}
