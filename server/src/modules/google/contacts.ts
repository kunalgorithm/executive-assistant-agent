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
const MAX_CONTACTS_RESULTS = 10;
const PAGE_SIZE = 1000;
const MAX_PAGES = 10; // 10k contacts is more than enough for a single-owner MVP

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

async function peopleClientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.people({ version: 'v1', auth });
}

type CacheEntry = { contacts: Contact[]; expiresAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
const contactsCache = new Map<string, CacheEntry>();

async function fetchAllContacts(userId: string): Promise<Contact[] | null> {
  const people = await peopleClientForUser(userId);
  if (!people) return null;

  const all: people_v1.Schema$Person[] = [];
  let pageToken: string | undefined;

  for (let i = 0; i < MAX_PAGES; i++) {
    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: CONTACT_READ_MASK,
      pageSize: PAGE_SIZE,
      pageToken,
    });
    if (data.connections) all.push(...data.connections);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return all.map(normalizeContact);
}

async function getCachedContacts(userId: string): Promise<Contact[] | null> {
  const cached = contactsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.contacts;

  try {
    const contacts = await fetchAllContacts(userId);
    if (!contacts) return null;
    contactsCache.set(userId, { contacts, expiresAt: Date.now() + CACHE_TTL_MS });
    return contacts;
  } catch (error) {
    logger.error('[contacts] fetchAllContacts failed', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

/**
 * Score a contact against a normalized (lowercase) query.
 * Higher = better match. 0 = no match.
 *
 * Hierarchy:
 *   100 full name equals query (e.g. "priya" == "Priya")
 *    90 any name token starts with query (first-name prefix, e.g. "pri" → "Priya Kumar")
 *    70 full name contains query
 *    50 email contains query
 *    30 organization contains query
 *    20 phone contains query (digits only)
 */
function scoreContact(contact: Contact, q: string): number {
  if (!q) return 0;

  const name = contact.displayName?.toLowerCase() ?? '';
  let score = 0;

  if (name) {
    if (name === q) score = Math.max(score, 100);
    else {
      const tokens = name.split(/\s+/);
      if (tokens.some((t) => t.startsWith(q))) score = Math.max(score, 90);
      if (name.includes(q)) score = Math.max(score, 70);
    }
  }

  if (contact.emails.some((e) => e.toLowerCase().includes(q))) {
    score = Math.max(score, 50);
  }

  if (contact.organization?.toLowerCase().includes(q)) {
    score = Math.max(score, 30);
  }

  const digitsQ = q.replace(/\D/g, '');
  if (digitsQ.length >= 3 && contact.phones.some((p) => p.replace(/\D/g, '').includes(digitsQ))) {
    score = Math.max(score, 20);
  }

  return score;
}

export type SearchContactsArgs = {
  query: string;
  maxResults?: number;
};

export async function searchContacts(userId: string, args: SearchContactsArgs) {
  const all = await getCachedContacts(userId);
  if (!all) return { ok: false as const, error: 'not_connected_or_api_error' };

  const q = args.query.trim().toLowerCase();
  if (!q) return { ok: true as const, contacts: [] };

  const scored = all
    .map((c) => ({ contact: c, score: scoreContact(c, q) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const limit = Math.min(args.maxResults ?? MAX_CONTACTS_RESULTS, MAX_CONTACTS_RESULTS);
  return { ok: true as const, contacts: scored.slice(0, limit).map((s) => s.contact) };
}
