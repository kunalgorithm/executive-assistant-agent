import type { ConnectedAccountContext } from '@/modules/connectors/contracts';

export type TaskSummary = {
  externalId: string;
  listExternalId?: string | null;
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
};

export type CreateTaskInput = {
  listExternalId?: string | null;
  title: string;
  notes?: string | null;
  dueAt?: string | null;
};

export interface TasksConnector {
  listTasks(account: ConnectedAccountContext, input?: { listExternalId?: string | null }): Promise<TaskSummary[]>;
  createTask(account: ConnectedAccountContext, input: CreateTaskInput): Promise<TaskSummary>;
  completeTask(
    account: ConnectedAccountContext,
    input: { externalId: string; listExternalId?: string | null },
  ): Promise<TaskSummary>;
}
