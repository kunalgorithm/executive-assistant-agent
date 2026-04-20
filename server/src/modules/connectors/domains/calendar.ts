import type { ConnectedAccountContext } from '@/modules/connectors/contracts';

export type CalendarSummary = {
  externalId: string;
  displayName: string;
  timezone?: string | null;
  isPrimary?: boolean;
};

export type CalendarEventSummary = {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  location?: string | null;
  description?: string | null;
  status?: string | null;
  calendarExternalId?: string | null;
};

export type CreateCalendarEventInput = {
  calendarExternalId?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  description?: string | null;
  location?: string | null;
  attendeeEmails?: string[];
};

export interface CalendarConnector {
  listCalendars(account: ConnectedAccountContext): Promise<CalendarSummary[]>;
  listEvents(
    account: ConnectedAccountContext,
    input: { fromIso: string; toIso: string; calendarExternalId?: string | null },
  ): Promise<CalendarEventSummary[]>;
  createEvent(account: ConnectedAccountContext, input: CreateCalendarEventInput): Promise<CalendarEventSummary>;
}
