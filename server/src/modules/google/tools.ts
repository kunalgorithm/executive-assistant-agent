import type { FunctionDeclaration } from '@google/genai';

import { logger } from '@/utils/log';
import { listEvents, createEvent, updateEvent, deleteEvent } from './calendar';
import { searchContacts } from './contacts';

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
      "Search the owner's Google Contacts by name, email, or keyword. Use this to look up a person's phone number, email address, or employer. Returns up to 10 matching contacts.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name, email, or keyword to search for. E.g. "John Smith" or "Acme Corp".',
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
