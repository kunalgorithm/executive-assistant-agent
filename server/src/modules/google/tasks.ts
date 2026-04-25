import { google } from 'googleapis';
import type { tasks_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForConnectedGoogleAccount, getAccessTokenForUser } from './oauth';
import { MICROSOFT_GRAPH_BASE, getMicrosoftAccessTokenForAccount } from '@/modules/microsoft/oauth';
import { getAccountsForFeature, getPrimaryAccountForFeature } from '@/modules/integrations/accounts';

export type Task = {
  id: string;
  accountId: string | null;
  provider: 'google' | 'microsoft';
  accountEmail: string | null;
  title: string;
  status: 'needsAction' | 'completed';
  due: string | null;
  notes: string | null;
  completed: string | null;
};

const DEFAULT_TASK_LIST = '@default';

type TaskAccount = {
  id: string;
  provider: 'google' | 'microsoft';
  email: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

function normalizeTask(task: tasks_v1.Schema$Task, account: { id: string | null; email: string | null }): Task {
  return {
    id: task.id ?? '',
    accountId: account.id,
    provider: 'google',
    accountEmail: account.email,
    title: task.title ?? '(no title)',
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    due: task.due ?? null,
    notes: task.notes ?? null,
    completed: task.completed ?? null,
  };
}

type MicrosoftTodoTask = {
  id?: string;
  title?: string;
  status?: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  dueDateTime?: { dateTime?: string; timeZone?: string };
  body?: { content?: string };
  completedDateTime?: { dateTime?: string };
};

function normalizeMicrosoftTask(task: MicrosoftTodoTask, account: TaskAccount): Task {
  return {
    id: task.id ?? '',
    accountId: account.id,
    provider: 'microsoft',
    accountEmail: account.email,
    title: task.title ?? '(no title)',
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    due: task.dueDateTime?.dateTime ?? null,
    notes: task.body?.content ?? null,
    completed: task.completedDateTime?.dateTime ?? null,
  };
}

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.tasks({ version: 'v1', auth });
}

async function clientForAccount(account: TaskAccount) {
  const accessToken = await getAccessTokenForConnectedGoogleAccount(account);
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
  const accounts = await getAccountsForFeature(userId, 'tasks');
  if (accounts.length > 0) {
    const results = await Promise.all(
      accounts.map((account) =>
        account.provider === 'microsoft' ? listMicrosoftTasks(account, args) : listGoogleTasksForAccount(account, args),
      ),
    );
    const tasks = results.flatMap((result) => (result.ok ? result.tasks : []));
    if (tasks.length > 0 || results.some((result) => result.ok)) {
      return { ok: true as const, tasks: tasks.slice(0, Math.min(args.maxResults ?? MAX_TASKS_RESULTS, MAX_TASKS_RESULTS)) };
    }
    return { ok: false as const, error: 'api_error' };
  }

  const client = await clientForUser(userId);
  if (!client) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await client.tasks.list({
      tasklist: DEFAULT_TASK_LIST,
      showCompleted: args.includeCompleted ?? false,
      showHidden: false,
      maxResults: Math.min(args.maxResults ?? MAX_TASKS_RESULTS, MAX_TASKS_RESULTS),
    });

    const tasks = (data.items ?? []).map((task) => normalizeTask(task, { id: null, email: null }));
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
  const account = await getPrimaryAccountForFeature(userId, 'tasks');
  if (account?.provider === 'microsoft') return createMicrosoftTask(account, args);

  const client = account?.provider === 'google' ? await clientForAccount(account) : await clientForUser(userId);
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

    return { ok: true as const, task: normalizeTask(data, { id: account?.id ?? null, email: account?.email ?? null }) };
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
  const account = await getPrimaryAccountForFeature(userId, 'tasks');
  if (account?.provider === 'microsoft') return updateMicrosoftTask(account, args);

  const client = account?.provider === 'google' ? await clientForAccount(account) : await clientForUser(userId);
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

    return { ok: true as const, task: normalizeTask(data, { id: account?.id ?? null, email: account?.email ?? null }) };
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
  const account = await getPrimaryAccountForFeature(userId, 'tasks');
  if (account?.provider === 'microsoft') return deleteMicrosoftTask(account, args);

  const client = account?.provider === 'google' ? await clientForAccount(account) : await clientForUser(userId);
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

async function getDefaultMicrosoftTaskListId(account: TaskAccount, accessToken: string): Promise<string | null> {
  const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/todo/lists?$top=1&$select=id,wellknownListName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    logger.error('[tasks] Microsoft task list fetch failed', { accountId: account.id, status: response.status });
    return null;
  }

  const data = (await response.json()) as { value?: Array<{ id?: string; wellknownListName?: string }> };
  return data.value?.find((list) => list.wellknownListName === 'defaultList')?.id ?? data.value?.[0]?.id ?? null;
}

async function microsoftTaskListRequest(account: TaskAccount) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return null;
  const listId = await getDefaultMicrosoftTaskListId(account, accessToken);
  if (!listId) return null;
  return { accessToken, listId };
}

async function listMicrosoftTasks(account: TaskAccount, args: ListTasksArgs) {
  const context = await microsoftTaskListRequest(account);
  if (!context) return { ok: false as const, error: 'not_connected' };

  const params = new URLSearchParams({
    $top: String(Math.min(args.maxResults ?? MAX_TASKS_RESULTS, MAX_TASKS_RESULTS)),
    $select: 'id,title,status,dueDateTime,body,completedDateTime',
  });
  if (!args.includeCompleted) params.set('$filter', "status ne 'completed'");

  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(context.listId)}/tasks?${params.toString()}`,
      { headers: { Authorization: `Bearer ${context.accessToken}` } },
    );
    if (!response.ok) {
      logger.error('[tasks] Microsoft listTasks failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }
    const data = (await response.json()) as { value?: MicrosoftTodoTask[] };
    return { ok: true as const, tasks: (data.value ?? []).map((task) => normalizeMicrosoftTask(task, account)) };
  } catch (error) {
    logger.error('[tasks] Microsoft listTasks failed', {
      accountId: account.id,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function createMicrosoftTask(account: TaskAccount, args: CreateTaskArgs) {
  const context = await microsoftTaskListRequest(account);
  if (!context) return { ok: false as const, error: 'not_connected' };

  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(context.listId)}/tasks`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: args.title,
          body: args.notes ? { content: args.notes, contentType: 'text' } : undefined,
          dueDateTime: args.due ? { dateTime: args.due, timeZone: 'UTC' } : undefined,
        }),
      },
    );
    if (!response.ok) {
      logger.error('[tasks] Microsoft createTask failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }
    const task = (await response.json()) as MicrosoftTodoTask;
    return { ok: true as const, task: normalizeMicrosoftTask(task, account) };
  } catch (error) {
    logger.error('[tasks] Microsoft createTask failed', {
      accountId: account.id,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function updateMicrosoftTask(account: TaskAccount, args: UpdateTaskArgs) {
  const context = await microsoftTaskListRequest(account);
  if (!context) return { ok: false as const, error: 'not_connected' };

  const patch: Record<string, unknown> = {};
  if (args.title !== undefined) patch.title = args.title;
  if (args.notes !== undefined) patch.body = { content: args.notes, contentType: 'text' };
  if (args.due !== undefined) patch.dueDateTime = { dateTime: args.due, timeZone: 'UTC' };
  if (args.status !== undefined) patch.status = args.status === 'completed' ? 'completed' : 'notStarted';

  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(context.listId)}/tasks/${encodeURIComponent(args.taskId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${context.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
    if (!response.ok) {
      logger.error('[tasks] Microsoft updateTask failed', {
        accountId: account.id,
        taskId: args.taskId,
        status: response.status,
      });
      return { ok: false as const, error: 'api_error' };
    }
    const task = (await response.json()) as MicrosoftTodoTask;
    return { ok: true as const, task: normalizeMicrosoftTask(task, account) };
  } catch (error) {
    logger.error('[tasks] Microsoft updateTask failed', {
      accountId: account.id,
      taskId: args.taskId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function deleteMicrosoftTask(account: TaskAccount, args: DeleteTaskArgs) {
  const context = await microsoftTaskListRequest(account);
  if (!context) return { ok: false as const, error: 'not_connected' };

  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/todo/lists/${encodeURIComponent(context.listId)}/tasks/${encodeURIComponent(args.taskId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${context.accessToken}` } },
    );
    if (!response.ok) {
      logger.error('[tasks] Microsoft deleteTask failed', {
        accountId: account.id,
        taskId: args.taskId,
        status: response.status,
      });
      return { ok: false as const, error: 'api_error' };
    }
    return { ok: true as const };
  } catch (error) {
    logger.error('[tasks] Microsoft deleteTask failed', {
      accountId: account.id,
      taskId: args.taskId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
