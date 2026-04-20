import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForUser } from './oauth';

/**
 * Minimal, AI-friendly event shape. Omit verbose Google fields the model doesn't need.
 */
export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  attendees: string[];
  hangoutLink: string | null;
  htmlLink: string;
};

function normalizeEvent(ev: calendar_v3.Schema$Event): CalendarEvent {
  const allDay = !!ev.start?.date && !ev.start?.dateTime;
  return {
    id: ev.id ?? '',
    summary: ev.summary ?? '(no title)',
    start: ev.start?.dateTime ?? ev.start?.date ?? '',
    end: ev.end?.dateTime ?? ev.end?.date ?? '',
    allDay,
    location: ev.location ?? null,
    description: ev.description ?? null,
    attendees: (ev.attendees ?? []).map((a) => a.email!).filter(Boolean),
    hangoutLink: ev.hangoutLink ?? null,
    htmlLink: ev.htmlLink ?? '',
  };
}

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch the owner's timezone from their primary Google Calendar.
 * This is the authoritative "local time" Google uses for them,
 * and is what we should use for interpreting relative dates like "today".
 */
export async function fetchPrimaryCalendarTimezone(accessToken: string): Promise<string | null> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const { data } = await calendar.calendars.get({ calendarId: 'primary' });
    return data.timeZone ?? null;
  } catch (error) {
    logger.warn('[calendar] Failed to fetch primary calendar timezone', {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export type ListEventsArgs = {
  timeMin: string; // ISO 8601
  timeMax: string; // ISO 8601
  query?: string;
  maxResults?: number;
};

export async function listEvents(userId: string, args: ListEventsArgs) {
  const calendar = await clientForUser(userId);
  if (!calendar) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      q: args.query,
      maxResults: Math.min(args.maxResults ?? 25, 50),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (data.items ?? []).map(normalizeEvent);
    return { ok: true as const, events };
  } catch (error) {
    logger.error('[calendar] listEvents failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type CreateEventArgs = {
  summary: string;
  start: string; // ISO 8601 with timezone offset
  end: string; // ISO 8601 with timezone offset
  attendees?: string[]; // emails
  location?: string;
  description?: string;
};

export async function createEvent(userId: string, args: CreateEventArgs) {
  const calendar = await clientForUser(userId);
  if (!calendar) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: args.summary,
        location: args.location,
        description: args.description,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        attendees: args.attendees?.map((email) => ({ email })),
      },
      sendUpdates: args.attendees && args.attendees.length > 0 ? 'all' : 'none',
    });

    return { ok: true as const, event: normalizeEvent(data) };
  } catch (error) {
    logger.error('[calendar] createEvent failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type UpdateEventArgs = {
  eventId: string;
  summary?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  location?: string;
  description?: string;
};

export async function updateEvent(userId: string, args: UpdateEventArgs) {
  const calendar = await clientForUser(userId);
  if (!calendar) return { ok: false as const, error: 'not_connected' };

  const patch: calendar_v3.Schema$Event = {};
  if (args.summary !== undefined) patch.summary = args.summary;
  if (args.location !== undefined) patch.location = args.location;
  if (args.description !== undefined) patch.description = args.description;
  if (args.start !== undefined) patch.start = { dateTime: args.start };
  if (args.end !== undefined) patch.end = { dateTime: args.end };
  if (args.attendees !== undefined) patch.attendees = args.attendees.map((email) => ({ email }));

  try {
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: args.eventId,
      requestBody: patch,
      sendUpdates: 'all',
    });
    return { ok: true as const, event: normalizeEvent(data) };
  } catch (error) {
    logger.error('[calendar] updateEvent failed', {
      userId,
      eventId: args.eventId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type DeleteEventArgs = { eventId: string };

export async function deleteEvent(userId: string, args: DeleteEventArgs) {
  const calendar = await clientForUser(userId);
  if (!calendar) return { ok: false as const, error: 'not_connected' };

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: args.eventId,
      sendUpdates: 'all',
    });
    return { ok: true as const };
  } catch (error) {
    logger.error('[calendar] deleteEvent failed', {
      userId,
      eventId: args.eventId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
