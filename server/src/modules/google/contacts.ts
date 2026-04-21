import { google } from 'googleapis';
import type { people_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForUser } from './oauth';

export type Contact = {
  resourceName: string;
  displayName: string | null;
  emails: string[];
  phones: string[];
  organization: string | null;
  jobTitle: string | null;
};

const CONTACT_READ_MASK = 'names,emailAddresses,phoneNumbers,organizations';

function normalizeContact(person: people_v1.Schema$Person): Contact {
  const name = person.names?.[0];
  const org = person.organizations?.[0];
  return {
    resourceName: person.resourceName ?? '',
    displayName: name?.displayName ?? null,
    emails: (person.emailAddresses ?? []).map((e) => e.value!).filter(Boolean),
    phones: (person.phoneNumbers ?? []).map((p) => p.value!).filter(Boolean),
    organization: org?.name ?? null,
    jobTitle: org?.title ?? null,
  };
}

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.people({ version: 'v1', auth });
}

export type SearchContactsArgs = {
  query: string;
  maxResults?: number;
};

const MAX_CONTACTS_RESULTS = 10;

export async function searchContacts(userId: string, args: SearchContactsArgs) {
  const people = await clientForUser(userId);
  if (!people) return { ok: false as const, error: 'not_connected' };

  try {
    const { data } = await people.people.searchContacts({
      query: args.query,
      readMask: CONTACT_READ_MASK,
      pageSize: Math.min(args.maxResults ?? MAX_CONTACTS_RESULTS, MAX_CONTACTS_RESULTS),
    });

    const contacts = (data.results ?? [])
      .map((r) => r.person)
      .filter((p): p is people_v1.Schema$Person => p != null)
      .map(normalizeContact);

    return { ok: true as const, contacts };
  } catch (error) {
    logger.error('[contacts] searchContacts failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
