import type { FunctionDeclaration } from '@google/genai';
import { z } from 'zod';

import { logger } from '@/utils/log';
import {
  cancelReminder,
  createReminder,
  listReminders,
  updateReminder,
  type CancelReminderArgs,
  type CreateReminderArgs,
  type ListRemindersArgs,
  type UpdateReminderArgs,
} from './reminders';

export const reminderFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_reminder',
    description:
      "Create an iMessage-native reminder managed by Sayla (not iOS Reminders). Use this when the owner asks to be reminded about birthdays, events, conflicts, busy windows, or any other follow-up at a specific time.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short reminder title, e.g. "mom birthday tomorrow".' },
        remindAt: {
          type: 'string',
          description:
            'When to send the reminder, as ISO 8601 datetime WITH timezone offset, e.g. "2026-04-21T09:00:00-07:00".',
        },
        note: { type: 'string', description: 'Optional extra context.' },
        category: {
          type: 'string',
          enum: ['general', 'birthday', 'event', 'conflict', 'busy_time'],
          description: 'Optional reminder category.',
        },
        recurrence: {
          type: 'string',
          enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
          description: 'Optional recurrence pattern. Use yearly for birthdays.',
        },
        interval: {
          type: 'integer',
          description: 'Optional recurrence interval. Defaults to 1 and must be >= 1.',
        },
        timezone: {
          type: 'string',
          description: 'Optional IANA timezone name if different from the owner profile timezone.',
        },
      },
      required: ['title', 'remindAt'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_reminders',
    description:
      'List existing reminders so you can answer reminder status questions, inspect upcoming reminders, or pick a reminder id before updates/cancellations.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled', 'processing', 'completed', 'cancelled'] },
        category: { type: 'string', enum: ['general', 'birthday', 'event', 'conflict', 'busy_time'] },
        from: {
          type: 'string',
          description: 'Optional ISO 8601 lower bound for remindAt (inclusive).',
        },
        to: {
          type: 'string',
          description: 'Optional ISO 8601 upper bound for remindAt (inclusive).',
        },
        limit: {
          type: 'integer',
          description: 'Optional max rows, default 25, capped at 50.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_reminder',
    description:
      'Update an existing reminder when the owner changes timing, wording, recurrence, or category. Use list_reminders first if you need to resolve reminder id.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        reminderId: { type: 'string', description: 'Reminder id from a previous list_reminders response.' },
        title: { type: 'string' },
        note: { type: 'string' },
        remindAt: {
          type: 'string',
          description: 'New reminder datetime as ISO 8601 WITH timezone offset.',
        },
        category: { type: 'string', enum: ['general', 'birthday', 'event', 'conflict', 'busy_time'] },
        recurrence: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
        interval: { type: 'integer', description: 'Recurrence interval >= 1.' },
        timezone: { type: 'string' },
        status: { type: 'string', enum: ['scheduled', 'processing', 'completed', 'cancelled'] },
      },
      required: ['reminderId'],
      additionalProperties: false,
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel an existing reminder so it no longer fires.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        reminderId: { type: 'string', description: 'Reminder id from a previous list_reminders response.' },
      },
      required: ['reminderId'],
      additionalProperties: false,
    },
  },
];

export const REMINDER_TOOL_NAMES = new Set(reminderFunctionDeclarations.map((d) => d.name!));

const reminderCategorySchema = z.enum(['general', 'birthday', 'event', 'conflict', 'busy_time']).optional();
const reminderStatusSchema = z.enum(['scheduled', 'processing', 'completed', 'cancelled']).optional();
const reminderRecurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional();

const createReminderArgsSchema = z.object({
  title: z.string().min(1),
  remindAt: z.string(),
  note: z.string().optional(),
  category: reminderCategorySchema,
  recurrence: reminderRecurrenceSchema,
  interval: z.number().int().min(1).optional(),
  timezone: z.string().optional(),
});

const listReminderArgsSchema = z.object({
  status: reminderStatusSchema,
  category: reminderCategorySchema,
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const updateReminderArgsSchema = z.object({
  reminderId: z.string().min(1),
  title: z.string().min(1).optional(),
  note: z.string().optional(),
  remindAt: z.string().optional(),
  category: reminderCategorySchema,
  recurrence: reminderRecurrenceSchema,
  interval: z.number().int().min(1).optional(),
  timezone: z.string().optional(),
  status: reminderStatusSchema,
});

const cancelReminderArgsSchema = z.object({
  reminderId: z.string().min(1),
});

type DispatcherContext = {
  userId: string;
  userTimezone: string;
};

export async function dispatchReminderToolCall(
  ctx: DispatcherContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'create_reminder': {
        const parsed = createReminderArgsSchema.safeParse(args);
        if (!parsed.success) return { ok: false, error: 'invalid_args', issues: parsed.error.flatten() };
        return (await createReminder(ctx.userId, ctx.userTimezone, parsed.data as CreateReminderArgs)) as unknown as Record<
          string,
          unknown
        >;
      }
      case 'list_reminders': {
        const parsed = listReminderArgsSchema.safeParse(args);
        if (!parsed.success) return { ok: false, error: 'invalid_args', issues: parsed.error.flatten() };
        return (await listReminders(ctx.userId, parsed.data as ListRemindersArgs)) as unknown as Record<string, unknown>;
      }
      case 'update_reminder': {
        const parsed = updateReminderArgsSchema.safeParse(args);
        if (!parsed.success) return { ok: false, error: 'invalid_args', issues: parsed.error.flatten() };
        return (await updateReminder(ctx.userId, parsed.data as UpdateReminderArgs)) as unknown as Record<string, unknown>;
      }
      case 'cancel_reminder': {
        const parsed = cancelReminderArgsSchema.safeParse(args);
        if (!parsed.success) return { ok: false, error: 'invalid_args', issues: parsed.error.flatten() };
        return (await cancelReminder(ctx.userId, parsed.data as CancelReminderArgs)) as unknown as Record<string, unknown>;
      }
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[reminder-tools] Dispatcher crashed', {
      userId: ctx.userId,
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}
