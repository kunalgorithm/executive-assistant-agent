import type { FunctionDeclaration } from '@google/genai';

import { logger } from '@/utils/log';
import { listEvents, createEvent, updateEvent, deleteEvent } from './calendar';
import { searchContacts } from './contacts';
import { listTasks, createTask, updateTask, deleteTask } from './tasks';
import { searchRestaurants } from './places';
import { listEmails, getEmail } from './gmail';

/**
 * Function declarations Gemini will choose from. We use parametersJsonSchema
 * (plain JSON schema) for ergonomics.
 */
export const calendarFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_calendar_events',
    description:
      "List events from the owner's primary Google Calendar between two times. Use this for any question about their schedule, availability, or what's coming up. Returns up to 25 events by default.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description:
            'Start of the window as an ISO 8601 datetime with timezone offset, e.g. "2026-04-19T00:00:00-07:00". Inclusive.',
        },
        timeMax: {
          type: 'string',
          description: 'End of the window as an ISO 8601 datetime with timezone offset. Exclusive.',
        },
        query: {
          type: 'string',
          description:
            'Optional text filter — only return events whose summary/description/attendees contain this text. Leave unset for all events in the window.',
        },
        maxResults: {
          type: 'integer',
          description: 'Optional max events to return, default 25, capped at 50.',
        },
      },
      required: ['timeMin', 'timeMax'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_calendar_event',
    description:
      "Create a new event on the owner's primary Google Calendar. Only call this AFTER the owner has explicitly confirmed the event details. Never call on first mention — always propose details in text first and wait for 'yes'.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title / short description.' },
        start: {
          type: 'string',
          description: 'Start datetime as ISO 8601 with timezone offset, e.g. "2026-04-22T14:00:00-07:00".',
        },
        end: {
          type: 'string',
          description: 'End datetime as ISO 8601 with timezone offset.',
        },
        attendees: {
          type: 'array',
          description: 'Optional list of attendee email addresses. Invitations will be sent automatically.',
          items: { type: 'string' },
        },
        location: { type: 'string', description: 'Optional location.' },
        description: { type: 'string', description: 'Optional longer description.' },
      },
      required: ['summary', 'start', 'end'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_calendar_event',
    description:
      "Reschedule, rename, or otherwise modify an existing event on the owner's primary calendar. Pass only the fields you want to change. Only call AFTER the owner has explicitly confirmed the change.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The event id from a prior list_calendar_events result.',
        },
        summary: { type: 'string' },
        start: { type: 'string', description: 'New start datetime (ISO 8601 with offset).' },
        end: { type: 'string', description: 'New end datetime (ISO 8601 with offset).' },
        attendees: { type: 'array', items: { type: 'string' } },
        location: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_calendar_event',
    description:
      'Cancel / delete an existing event. Only call AFTER the owner has explicitly confirmed the cancellation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The event id from a prior list_calendar_events result.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
  },
];

export const CALENDAR_TOOL_NAMES = new Set(calendarFunctionDeclarations.map((d) => d.name!));

export const contactsFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_contacts',
    description:
      'Search the owner\'s Google Contacts by name, email, phone, or company. Partial matches work — passing just a first name (e.g. "priya"), a fragment ("kum"), or an email handle ("priya@") all return matching contacts. Returns up to 10 matches ranked by how well they match. Use this to look up a person\'s phone number, email, or employer.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What to search for. Can be a first name, last name, partial name, full name, email (or email fragment), company name, or phone number digits. Case-insensitive. Examples: "priya", "kumar", "priya kumar", "@acme.com", "415555".',
        },
        maxResults: {
          type: 'integer',
          description: 'Optional max contacts to return, default 10, capped at 10.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

export const CONTACTS_TOOL_NAMES = new Set(contactsFunctionDeclarations.map((d) => d.name!));

export const tasksFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_tasks',
    description:
      "List tasks from the owner's default Google Tasks list. Use this for any question about their to-dos or task list. Returns open tasks by default.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        includeCompleted: {
          type: 'boolean',
          description: 'Set to true to include completed tasks. Defaults to false (open tasks only).',
        },
        maxResults: {
          type: 'integer',
          description: 'Optional max tasks to return, default 20, capped at 20.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_task',
    description:
      "Add a new task to the owner's default Google Tasks list. Only call AFTER the owner has explicitly confirmed the task details.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title.' },
        notes: { type: 'string', description: 'Optional notes or description.' },
        due: {
          type: 'string',
          description: 'Optional due date as RFC 3339 UTC datetime, e.g. "2026-04-22T00:00:00.000Z".',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_task',
    description:
      'Update an existing task — rename it, change its due date, add notes, or mark it complete/incomplete. Only call AFTER the owner has explicitly confirmed the change.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task id from a prior list_tasks result.' },
        title: { type: 'string', description: 'New title.' },
        notes: { type: 'string', description: 'New notes.' },
        due: { type: 'string', description: 'New due date as RFC 3339 UTC datetime.' },
        status: {
          type: 'string',
          enum: ['needsAction', 'completed'],
          description: 'Set to "completed" to mark done, "needsAction" to reopen.',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. Only call AFTER the owner has explicitly confirmed the deletion.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task id from a prior list_tasks result.' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
];

export const TASKS_TOOL_NAMES = new Set(tasksFunctionDeclarations.map((d) => d.name!));

export const restaurantFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_restaurants',
    description:
      'Search for restaurants using Google Places. Use this for any request about finding a place to eat, checking if a restaurant is open, or getting a booking link. Returns up to 5 results with ratings, hours, price level, phone number, website, and a Google Maps link the owner can tap to book via Reserve with Google.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query including cuisine, location, and any constraints. E.g. "Italian restaurant in SoHo NYC open Saturday at 8pm" or "best sushi near Chelsea Manhattan".',
        },
        maxResults: {
          type: 'integer',
          description: 'Optional max results to return, default 5, capped at 5.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

export const RESTAURANT_TOOL_NAMES = new Set(restaurantFunctionDeclarations.map((d) => d.name!));

export const gmailFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_emails',
    description:
      "List messages from the owner's Gmail inbox. Use this for any question about their email — what's unread, who's emailed them, what needs attention, what came from a specific sender. Returns envelope metadata (from, subject, date, snippet, unread status) for up to 20 matching messages. Use get_email to pull the full body of a specific message when the owner asks to summarize or read it.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional Gmail search query using Gmail\'s own operators. Examples: "is:unread" (unread messages), "from:priya@example.com" (from a specific sender), "subject:invoice" (subject contains), "newer_than:7d" (last week), "has:attachment", "in:important". Combine with spaces for AND, e.g. "is:unread newer_than:3d". Leave unset to return the 10 newest messages in the inbox.',
        },
        maxResults: {
          type: 'integer',
          description: 'Optional max messages to return, default 10, capped at 20.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_email',
    description:
      'Fetch the full body of a single email by its messageId (obtained from a prior list_emails result). Use this when the owner asks you to summarize, read, or pull details from a specific message. Returns the headers plus the plaintext body (truncated at ~8000 chars). Read-only — does NOT mark the message as read or modify state.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The message id from a prior list_emails result.',
        },
      },
      required: ['messageId'],
      additionalProperties: false,
    },
  },
];

export const GMAIL_TOOL_NAMES = new Set(gmailFunctionDeclarations.map((d) => d.name!));

/**
 * Run a function call against the user's calendar and return a serializable result.
 * Errors are returned in-band so the model can explain them to the owner.
 */
export async function dispatchCalendarToolCall(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'list_calendar_events':
        return (await listEvents(userId, args as Parameters<typeof listEvents>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'create_calendar_event':
        return (await createEvent(userId, args as Parameters<typeof createEvent>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'update_calendar_event':
        return (await updateEvent(userId, args as Parameters<typeof updateEvent>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'delete_calendar_event':
        return (await deleteEvent(userId, args as Parameters<typeof deleteEvent>[1])) as unknown as Record<
          string,
          unknown
        >;
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[calendar-tools] Dispatcher crashed', {
      userId,
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}

export async function dispatchContactsToolCall(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'search_contacts':
        return (await searchContacts(userId, args as Parameters<typeof searchContacts>[1])) as unknown as Record<
          string,
          unknown
        >;
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[contacts-tools] Dispatcher crashed', {
      userId,
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}

export async function dispatchTasksToolCall(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'list_tasks':
        return (await listTasks(userId, args as Parameters<typeof listTasks>[1])) as unknown as Record<string, unknown>;
      case 'create_task':
        return (await createTask(userId, args as Parameters<typeof createTask>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'update_task':
        return (await updateTask(userId, args as Parameters<typeof updateTask>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'delete_task':
        return (await deleteTask(userId, args as Parameters<typeof deleteTask>[1])) as unknown as Record<
          string,
          unknown
        >;
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[tasks-tools] Dispatcher crashed', {
      userId,
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}

export async function dispatchGmailToolCall(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'list_emails':
        return (await listEmails(userId, args as Parameters<typeof listEmails>[1])) as unknown as Record<
          string,
          unknown
        >;
      case 'get_email':
        return (await getEmail(userId, args as Parameters<typeof getEmail>[1])) as unknown as Record<string, unknown>;
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[gmail-tools] Dispatcher crashed', {
      userId,
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}

export async function dispatchRestaurantToolCall(
  _userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'search_restaurants':
        return (await searchRestaurants(args as Parameters<typeof searchRestaurants>[0])) as unknown as Record<
          string,
          unknown
        >;
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (error) {
    logger.error('[restaurant-tools] Dispatcher crashed', {
      name,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, error: 'dispatcher_crash' };
  }
}
