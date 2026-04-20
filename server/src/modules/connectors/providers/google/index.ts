import type { CalendarConnector } from '@/modules/connectors/domains/calendar';
import type { ContactsConnector } from '@/modules/connectors/domains/contacts';
import type { TasksConnector } from '@/modules/connectors/domains/tasks';

async function notImplemented(operation: string): Promise<never> {
  throw new Error(`Google connector operation "${operation}" is not implemented yet`);
}

export const googleCalendarConnector: CalendarConnector = {
  listCalendars: () => notImplemented('calendar.listCalendars'),
  listEvents: () => notImplemented('calendar.listEvents'),
  createEvent: () => notImplemented('calendar.createEvent'),
};

export const googleContactsConnector: ContactsConnector = {
  searchContacts: () => notImplemented('contacts.searchContacts'),
  createContact: () => notImplemented('contacts.createContact'),
};

export const googleTasksConnector: TasksConnector = {
  listTasks: () => notImplemented('tasks.listTasks'),
  createTask: () => notImplemented('tasks.createTask'),
  completeTask: () => notImplemented('tasks.completeTask'),
};
