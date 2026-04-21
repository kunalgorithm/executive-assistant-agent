import { google } from 'googleapis';
import type { tasks_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForUser } from './oauth';

export type Task = {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due: string | null;
  notes: string | null;
  completed: string | null;
};

const DEFAULT_TASK_LIST = '@default';

function normalizeTask(task: tasks_v1.Schema$Task): Task {
  return {
    id: task.id ?? '',
    title: task.title ?? '(no title)',
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    due: task.due ?? null,
    notes: task.notes ?? null,
    completed: task.completed ?? null,
  };
}

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.tasks({ version: 'v1', auth });
}

export type ListTasksArgs = {
  includeCompleted?: boolean;
  maxResults?: number;
};

const MAX_TASKS_RESULTS = 20;

export async function listTasks(userId: string, args: ListTasksArgs) {
  const client = await clientForUser(userId);
  if (!client) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await client.tasks.list({
      tasklist: DEFAULT_TASK_LIST,
      showCompleted: args.includeCompleted ?? false,
      showHidden: false,
      maxResults: Math.min(args.maxResults ?? MAX_TASKS_RESULTS, MAX_TASKS_RESULTS),
    });

    const tasks = (data.items ?? []).map(normalizeTask);
    return { ok: true as const, tasks };
  } catch (error) {
    logger.error('[tasks] listTasks failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type CreateTaskArgs = {
  title: string;
  notes?: string;
  due?: string; // RFC 3339 date, e.g. "2026-04-22T00:00:00.000Z"
};

export async function createTask(userId: string, args: CreateTaskArgs) {
  const client = await clientForUser(userId);
  if (!client) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await client.tasks.insert({
      tasklist: DEFAULT_TASK_LIST,
      requestBody: {
        title: args.title,
        notes: args.notes,
        due: args.due,
      },
    });

    return { ok: true as const, task: normalizeTask(data) };
  } catch (error) {
    logger.error('[tasks] createTask failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type UpdateTaskArgs = {
  taskId: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
};

export async function updateTask(userId: string, args: UpdateTaskArgs) {
  const client = await clientForUser(userId);
  if (!client) return { ok: false as const, error: 'not_connected' };

  const patch: tasks_v1.Schema$Task = {};
  if (args.title !== undefined) patch.title = args.title;
  if (args.notes !== undefined) patch.notes = args.notes;
  if (args.due !== undefined) patch.due = args.due;
  if (args.status !== undefined) patch.status = args.status;

  try {
    const { data } = await client.tasks.patch({
      tasklist: DEFAULT_TASK_LIST,
      task: args.taskId,
      requestBody: patch,
    });

    return { ok: true as const, task: normalizeTask(data) };
  } catch (error) {
    logger.error('[tasks] updateTask failed', {
      userId,
      taskId: args.taskId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type DeleteTaskArgs = { taskId: string };

export async function deleteTask(userId: string, args: DeleteTaskArgs) {
  const client = await clientForUser(userId);
  if (!client) return { ok: false as const, error: 'not_connected' };

  try {
    await client.tasks.delete({
      tasklist: DEFAULT_TASK_LIST,
      task: args.taskId,
    });

    return { ok: true as const };
  } catch (error) {
    logger.error('[tasks] deleteTask failed', {
      userId,
      taskId: args.taskId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
