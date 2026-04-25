import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForConnectedGoogleAccount, getAccessTokenForUser } from './oauth';
import { MICROSOFT_GRAPH_BASE, getMicrosoftAccessTokenForAccount } from '@/modules/microsoft/oauth';
import { getAccountsForFeature, getPrimaryAccountForFeature } from '@/modules/integrations/accounts';

/**
 * Minimal, AI-friendly event shape. Omit verbose Google fields the model doesn't need.
 */
export type CalendarEvent = {
  id: string;
  accountId: string | null;
  provider: 'google' | 'microsoft';
  accountEmail: string | null;
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

function normalizeGoogleEvent(
  ev: calendar_v3.Schema$Event,
  account: { id: string | null; email: string | null },
): CalendarEvent {
  const allDay = !!ev.start?.date && !ev.start?.dateTime;
  return {
    id: ev.id ?? '',
    accountId: account.id,
    provider: 'google',
    accountEmail: account.email,
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

type MicrosoftEvent = {
  id?: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  location?: { displayName?: string };
  bodyPreview?: string;
  attendees?: Array<{ emailAddress?: { address?: string } }>;
  onlineMeetingUrl?: string;
  webLink?: string;
};

type CalendarAccount = {
  id: string;
  provider: 'google' | 'microsoft';
  email: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

function normalizeMicrosoftEvent(
  ev: MicrosoftEvent,
  account: { id: string; email: string | null },
): CalendarEvent {
  return {
    id: ev.id ?? '',
    accountId: account.id,
    provider: 'microsoft',
    accountEmail: account.email,
    summary: ev.subject ?? '(no title)',
    start: ev.start?.dateTime ?? '',
    end: ev.end?.dateTime ?? '',
    allDay: ev.isAllDay ?? false,
    location: ev.location?.displayName ?? null,
    description: ev.bodyPreview ?? null,
    attendees: (ev.attendees ?? []).map((a) => a.emailAddress?.address).filter((email): email is string => !!email),
    hangoutLink: ev.onlineMeetingUrl ?? null,
    htmlLink: ev.webLink ?? '',
  };
}

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

async function googleClientForAccount(account: CalendarAccount) {
  const accessToken = await getAccessTokenForConnectedGoogleAccount(account);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

async function listGoogleEventsFromLegacyUser(userId: string, args: ListEventsArgs) {
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

    const events = (data.items ?? []).map((event) => normalizeGoogleEvent(event, { id: null, email: null }));
    return { ok: true as const, events };
  } catch (error) {
    logger.error('[calendar] listEvents failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function listGoogleEventsForAccount(account: CalendarAccount, args: ListEventsArgs) {
  const calendar = await googleClientForAccount(account);
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

    const events = (data.items ?? []).map((event) => normalizeGoogleEvent(event, account));
    return { ok: true as const, events };
  } catch (error) {
    logger.error('[calendar] listEvents failed', {
      accountId: account.id,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function listMicrosoftEventsForAccount(account: CalendarAccount, args: ListEventsArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  const params = new URLSearchParams({
    startDateTime: args.timeMin,
    endDateTime: args.timeMax,
    $top: String(Math.min(args.maxResults ?? 25, 50)),
    $orderby: 'start/dateTime',
    $select: 'id,subject,start,end,isAllDay,location,bodyPreview,attendees,onlineMeetingUrl,webLink',
  });
  if (args.query) params.set('$filter', `contains(subject,'${escapeODataString(args.query)}')`);

  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/calendarView?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!response.ok) {
      logger.error('[calendar] Microsoft listEvents failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }

    const data = (await response.json()) as { value?: MicrosoftEvent[] };
    return { ok: true as const, events: (data.value ?? []).map((event) => normalizeMicrosoftEvent(event, account)) };
  } catch (error) {
    logger.error('[calendar] Microsoft listEvents failed', {
      accountId: account.id,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function createMicrosoftEvent(account: CalendarAccount, args: CreateEventArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: args.summary,
        body: args.description ? { contentType: 'text', content: args.description } : undefined,
        start: { dateTime: args.start, timeZone: 'UTC' },
        end: { dateTime: args.end, timeZone: 'UTC' },
        location: args.location ? { displayName: args.location } : undefined,
        attendees: args.attendees?.map((email) => ({
          emailAddress: { address: email },
          type: 'required',
        })),
      }),
    });

    if (!response.ok) {
      logger.error('[calendar] Microsoft createEvent failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }

    const event = (await response.json()) as MicrosoftEvent;
    return { ok: true as const, event: normalizeMicrosoftEvent(event, account) };
  } catch (error) {
    logger.error('[calendar] Microsoft createEvent failed', {
      accountId: account.id,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function updateMicrosoftEvent(account: CalendarAccount, args: UpdateEventArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  const patch: Record<string, unknown> = {};
  if (args.summary !== undefined) patch.subject = args.summary;
  if (args.description !== undefined) patch.body = { contentType: 'text', content: args.description };
  if (args.start !== undefined) patch.start = { dateTime: args.start, timeZone: 'UTC' };
  if (args.end !== undefined) patch.end = { dateTime: args.end, timeZone: 'UTC' };
  if (args.location !== undefined) patch.location = { displayName: args.location };
  if (args.attendees !== undefined) {
    patch.attendees = args.attendees.map((email) => ({ emailAddress: { address: email }, type: 'required' }));
  }

  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/events/${encodeURIComponent(args.eventId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      logger.error('[calendar] Microsoft updateEvent failed', {
        accountId: account.id,
        eventId: args.eventId,
        status: response.status,
      });
      return { ok: false as const, error: 'api_error' };
    }

    const event = (await response.json()) as MicrosoftEvent;
    return { ok: true as const, event: normalizeMicrosoftEvent(event, account) };
  } catch (error) {
    logger.error('[calendar] Microsoft updateEvent failed', {
      accountId: account.id,
      eventId: args.eventId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function deleteMicrosoftEvent(account: CalendarAccount, args: DeleteEventArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/events/${encodeURIComponent(args.eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      logger.error('[calendar] Microsoft deleteEvent failed', {
        accountId: account.id,
        eventId: args.eventId,
        status: response.status,
      });
      return { ok: false as const, error: 'api_error' };
    }

    return { ok: true as const };
  } catch (error) {
    logger.error('[calendar] Microsoft deleteEvent failed', {
      accountId: account.id,
      eventId: args.eventId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
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
  const connectedAccounts = await getAccountsForFeature(userId, 'calendar');
  if (connectedAccounts.length === 0) return listGoogleEventsFromLegacyUser(userId, args);

  const results = await Promise.all(
    connectedAccounts.map(async (account) => {
      if (account.provider === 'google') return listGoogleEventsForAccount(account, args);
      return listMicrosoftEventsForAccount(account, args);
    }),
  );

  const events = results.flatMap((result) => (result.ok ? result.events : []));
  if (events.length > 0 || results.some((result) => result.ok)) {
    return {
      ok: true as const,
      events: events
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, Math.min(args.maxResults ?? 25, 50)),
    };
  }

  return { ok: false as const, error: 'api_error' };
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
  const account = await getPrimaryAccountForFeature(userId, 'calendar');
  if (account?.provider === 'microsoft') return createMicrosoftEvent(account, args);

  const calendar = account?.provider === 'google' ? await googleClientForAccount(account) : await clientForUser(userId);
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

    return {
      ok: true as const,
      event: normalizeGoogleEvent(data, { id: account?.id ?? null, email: account?.email ?? null }),
    };
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
  const account = await getPrimaryAccountForFeature(userId, 'calendar');
  if (account?.provider === 'microsoft') return updateMicrosoftEvent(account, args);

  const calendar = account?.provider === 'google' ? await googleClientForAccount(account) : await clientForUser(userId);
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
    return {
      ok: true as const,
      event: normalizeGoogleEvent(data, { id: account?.id ?? null, email: account?.email ?? null }),
    };
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
  const account = await getPrimaryAccountForFeature(userId, 'calendar');
  if (account?.provider === 'microsoft') return deleteMicrosoftEvent(account, args);

  const calendar = account?.provider === 'google' ? await googleClientForAccount(account) : await clientForUser(userId);
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
