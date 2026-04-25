import { logger } from '@/utils/log';

type MicrosoftCalendar = {
  timeZone?: string;
};

export async function fetchMicrosoftPrimaryCalendarTimezone(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar?$select=timeZone', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const calendar = (await response.json()) as MicrosoftCalendar;
    return calendar.timeZone ?? null;
  } catch (error) {
    logger.warn('[microsoft-calendar] Failed to fetch primary calendar timezone', {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}
