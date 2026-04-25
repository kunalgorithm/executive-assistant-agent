import { google } from 'googleapis';
import type { people_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForConnectedGoogleAccount, getAccessTokenForUser } from './oauth';
import { MICROSOFT_GRAPH_BASE, getMicrosoftAccessTokenForAccount } from '@/modules/microsoft/oauth';
import { getAccountsForFeature } from '@/modules/integrations/accounts';

export type Contact = {
  resourceName: string;
  accountId: string | null;
  provider: 'google' | 'microsoft';
  accountEmail: string | null;
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

type ContactAccount = {
  id: string;
  provider: 'google' | 'microsoft';
  email: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

function normalizeContact(person: people_v1.Schema$Person, account: { id: string | null; email: string | null }): Contact {
  const name = person.names?.[0];
  const org = person.organizations?.[0];
  return {
    resourceName: person.resourceName ?? '',
    accountId: account.id,
    provider: 'google',
    accountEmail: account.email,
    displayName: name?.displayName ?? null,
    emails: (person.emailAddresses ?? []).map((e) => e.value!).filter(Boolean),
    phones: (person.phoneNumbers ?? []).map((p) => p.value!).filter(Boolean),
    organization: org?.name ?? null,
    jobTitle: org?.title ?? null,
  };
}

type MicrosoftContact = {
  id?: string;
  displayName?: string;
  emailAddresses?: Array<{ address?: string }>;
  businessPhones?: string[];
  mobilePhone?: string;
  companyName?: string;
  jobTitle?: string;
};

function normalizeMicrosoftContact(contact: MicrosoftContact, account: ContactAccount): Contact {
  return {
    resourceName: contact.id ?? '',
    accountId: account.id,
    provider: 'microsoft',
    accountEmail: account.email,
    displayName: contact.displayName ?? null,
    emails: (contact.emailAddresses ?? []).map((email) => email.address).filter((email): email is string => !!email),
    phones: [...(contact.businessPhones ?? []), contact.mobilePhone].filter((phone): phone is string => !!phone),
    organization: contact.companyName ?? null,
    jobTitle: contact.jobTitle ?? null,
  };
}

async function peopleClientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.people({ version: 'v1', auth });
}

async function peopleClientForAccount(account: ContactAccount) {
  const accessToken = await getAccessTokenForConnectedGoogleAccount(account);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.people({ version: 'v1', auth });
}

type CacheEntry = { contacts: Contact[]; expiresAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
const contactsCache = new Map<string, CacheEntry>();

async function fetchAllContacts(userId: string): Promise<Contact[] | null> {
  const accounts = await getAccountsForFeature(userId, 'contacts');
  if (accounts.length > 0) {
    const contactLists = await Promise.all(
      accounts.map((account) =>
        account.provider === 'google' ? fetchGoogleContactsForAccount(account) : fetchMicrosoftContactsForAccount(account),
      ),
    );
    return contactLists.flatMap((contacts) => contacts ?? []);
  }

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

  return all.map((person) => normalizeContact(person, { id: null, email: null }));
}

async function fetchGoogleContactsForAccount(account: ContactAccount): Promise<Contact[] | null> {
  const people = await peopleClientForAccount(account);
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

  return all.map((person) => normalizeContact(person, account));
}

async function fetchMicrosoftContactsForAccount(account: ContactAccount): Promise<Contact[] | null> {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return null;

  const contacts: MicrosoftContact[] = [];
  let nextUrl: string | null =
    `${MICROSOFT_GRAPH_BASE}/me/contacts?$top=999&$select=id,displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle`;

  for (let i = 0; i < MAX_PAGES && nextUrl; i++) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      logger.error('[contacts] Microsoft contacts fetch failed', { accountId: account.id, status: response.status });
      return null;
    }
    const data = (await response.json()) as { value?: MicrosoftContact[]; '@odata.nextLink'?: string };
    contacts.push(...(data.value ?? []));
    nextUrl = data['@odata.nextLink'] ?? null;
  }

  return contacts.map((contact) => normalizeMicrosoftContact(contact, account));
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
