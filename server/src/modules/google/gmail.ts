import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForConnectedGoogleAccount, getAccessTokenForUser } from './oauth';
import { MICROSOFT_GRAPH_BASE, getMicrosoftAccessTokenForAccount } from '@/modules/microsoft/oauth';
import { getAccountsForFeature, getPrimaryAccountForFeature } from '@/modules/integrations/accounts';

export type EmailSummary = {
  messageId: string;
  accountId: string | null;
  provider: 'google' | 'microsoft';
  accountEmail: string | null;
  threadId: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  date: string | null;
  snippet: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
};

export type EmailDetail = EmailSummary & {
  body: string; // plaintext, best-effort decoded
  bodyTruncated: boolean;
};

/**
 * Gmail's message body can be huge (HTML multipart, attachments).
 * We cap what we return to the model so token cost stays sane.
 */
const MAX_BODY_CHARS = 8000;
const MAX_LIST_RESULTS = 20;

type EmailAccount = {
  id: string;
  provider: 'google' | 'microsoft';
  email: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

async function googleClientForAccount(account: EmailAccount) {
  const accessToken = await getAccessTokenForConnectedGoogleAccount(account);
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  const hit = headers.find((h) => h.name?.toLowerCase() === lower);
  return hit?.value ?? null;
}

function normalizeGoogleSummary(
  msg: gmail_v1.Schema$Message,
  account: { id: string | null; email: string | null },
): EmailSummary {
  const headers = msg.payload?.headers ?? [];
  const labels = msg.labelIds ?? [];
  return {
    messageId: msg.id ?? '',
    accountId: account.id,
    provider: 'google',
    accountEmail: account.email,
    threadId: msg.threadId ?? '',
    from: headerValue(headers, 'From'),
    to: headerValue(headers, 'To'),
    subject: headerValue(headers, 'Subject'),
    date: headerValue(headers, 'Date'),
    snippet: msg.snippet ?? '',
    unread: labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    labels,
  };
}

type MicrosoftMessage = {
  id?: string;
  conversationId?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  subject?: string;
  receivedDateTime?: string;
  bodyPreview?: string;
  isRead?: boolean;
  flag?: { flagStatus?: string };
  body?: { content?: string; contentType?: string };
  webLink?: string;
  categories?: string[];
};

function normalizeMicrosoftSummary(message: MicrosoftMessage, account: EmailAccount): EmailSummary {
  return {
    messageId: message.id ?? '',
    accountId: account.id,
    provider: 'microsoft',
    accountEmail: account.email,
    threadId: message.conversationId ?? message.id ?? '',
    from: message.from?.emailAddress?.address ?? message.from?.emailAddress?.name ?? null,
    to: (message.toRecipients ?? []).map((recipient) => recipient.emailAddress?.address).filter(Boolean).join(', ') || null,
    subject: message.subject ?? null,
    date: message.receivedDateTime ?? null,
    snippet: message.bodyPreview ?? '',
    unread: message.isRead === false,
    starred: message.flag?.flagStatus === 'flagged',
    labels: message.categories ?? [],
  };
}

/**
 * Walk a Gmail MIME tree looking for the richest plaintext body.
 * Prefers text/plain; falls back to stripping HTML from text/html.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  const decode = (data: string | null | undefined): string => {
    if (!data) return '';
    try {
      return Buffer.from(data, 'base64url').toString('utf-8');
    } catch {
      return '';
    }
  };

  // Collect (mimeType, text) pairs from the whole tree
  const collected: Array<{ mime: string; text: string }> = [];
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? '';
    const raw = decode(part.body?.data);
    if (raw && (mime === 'text/plain' || mime === 'text/html')) {
      collected.push({ mime, text: mime === 'text/html' ? stripHtml(raw) : raw });
    }
    part.parts?.forEach(walk);
  };
  walk(payload);

  const plain = collected.find((c) => c.mime === 'text/plain')?.text;
  if (plain && plain.trim()) return plain.trim();
  const html = collected.find((c) => c.mime === 'text/html')?.text;
  if (html && html.trim()) return html.trim();
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function listGoogleEmailsForAccount(account: EmailAccount, args: ListEmailsArgs) {
  const gmail = await googleClientForAccount(account);
  if (!gmail) return { ok: false as const, error: 'not_connected' };

  try {
    const { data: list } = await gmail.users.messages.list({
      userId: 'me',
      q: args.query,
      maxResults: Math.min(args.maxResults ?? 10, MAX_LIST_RESULTS),
    });

    const ids = (list.messages ?? []).map((m) => m.id!).filter(Boolean);
    if (ids.length === 0) return { ok: true as const, messages: [] as EmailSummary[] };

    const details = await Promise.all(
      ids.map((id) =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        }),
      ),
    );

    return { ok: true as const, messages: details.map((detail) => normalizeGoogleSummary(detail.data, account)) };
  } catch (error) {
    logger.error('[gmail] listEmails failed', {
      accountId: account.id,
      query: args.query,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function getGoogleEmailForAccount(account: EmailAccount, args: GetEmailArgs) {
  const gmail = await googleClientForAccount(account);
  if (!gmail) return { ok: false as const, error: 'not_connected' };

  try {
    const { data: msg } = await gmail.users.messages.get({
      userId: 'me',
      id: args.messageId,
      format: 'full',
    });

    const summary = normalizeGoogleSummary(msg, account);
    const fullBody = extractBody(msg.payload);
    const bodyTruncated = fullBody.length > MAX_BODY_CHARS;
    return {
      ok: true as const,
      email: { ...summary, body: bodyTruncated ? fullBody.slice(0, MAX_BODY_CHARS) : fullBody, bodyTruncated },
    };
  } catch (error) {
    logger.error('[gmail] getEmail failed', {
      accountId: account.id,
      messageId: args.messageId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function listMicrosoftEmailsForAccount(account: EmailAccount, args: ListEmailsArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  const params = new URLSearchParams({
    $top: String(Math.min(args.maxResults ?? 10, MAX_LIST_RESULTS)),
    $orderby: 'receivedDateTime desc',
    $select:
      'id,conversationId,from,toRecipients,subject,receivedDateTime,bodyPreview,isRead,flag,categories,webLink',
  });
  if (args.query) params.set('$search', `"${args.query.replace(/"/g, '\\"')}"`);

  try {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/messages?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: 'eventual',
      },
    });
    if (!response.ok) {
      logger.error('[gmail] Microsoft listEmails failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }

    const data = (await response.json()) as { value?: MicrosoftMessage[] };
    return { ok: true as const, messages: (data.value ?? []).map((message) => normalizeMicrosoftSummary(message, account)) };
  } catch (error) {
    logger.error('[gmail] Microsoft listEmails failed', {
      accountId: account.id,
      query: args.query,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

async function getMicrosoftEmailForAccount(account: EmailAccount, args: GetEmailArgs) {
  const accessToken = await getMicrosoftAccessTokenForAccount(account.id);
  if (!accessToken) return { ok: false as const, error: 'not_connected' };

  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_BASE}/me/messages/${encodeURIComponent(args.messageId)}?$select=id,conversationId,from,toRecipients,subject,receivedDateTime,bodyPreview,isRead,flag,categories,body,webLink`,
      { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' } },
    );
    if (!response.ok) {
      logger.error('[gmail] Microsoft getEmail failed', { accountId: account.id, status: response.status });
      return { ok: false as const, error: 'api_error' };
    }

    const message = (await response.json()) as MicrosoftMessage;
    const summary = normalizeMicrosoftSummary(message, account);
    const fullBody = message.body?.contentType === 'html' ? stripHtml(message.body.content ?? '') : (message.body?.content ?? '');
    const bodyTruncated = fullBody.length > MAX_BODY_CHARS;
    return {
      ok: true as const,
      email: { ...summary, body: bodyTruncated ? fullBody.slice(0, MAX_BODY_CHARS) : fullBody, bodyTruncated },
    };
  } catch (error) {
    logger.error('[gmail] Microsoft getEmail failed', {
      accountId: account.id,
      messageId: args.messageId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type ListEmailsArgs = {
  query?: string;
  maxResults?: number;
};

export async function listEmails(userId: string, args: ListEmailsArgs) {
  const accounts = await getAccountsForFeature(userId, 'email');
  if (accounts.length > 0) {
    const results = await Promise.all(
      accounts.map((account) =>
        account.provider === 'google' ? listGoogleEmailsForAccount(account, args) : listMicrosoftEmailsForAccount(account, args),
      ),
    );
    const messages = results.flatMap((result) => (result.ok ? result.messages : []));
    if (messages.length > 0 || results.some((result) => result.ok)) {
      return { ok: true as const, messages: messages.slice(0, Math.min(args.maxResults ?? 10, MAX_LIST_RESULTS)) };
    }
    return { ok: false as const, error: 'api_error' };
  }

  const gmail = await clientForUser(userId);
  if (!gmail) return { ok: false as const, error: 'not_connected' };

  try {
    const { data: list } = await gmail.users.messages.list({
      userId: 'me',
      q: args.query,
      maxResults: Math.min(args.maxResults ?? 10, MAX_LIST_RESULTS),
    });

    const ids = (list.messages ?? []).map((m) => m.id!).filter(Boolean);
    if (ids.length === 0) return { ok: true as const, messages: [] as EmailSummary[] };

    // Fetch metadata for each id in parallel.
    const details = await Promise.all(
      ids.map((id) =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        }),
      ),
    );

    const messages = details.map((d) => normalizeGoogleSummary(d.data, { id: null, email: null }));
    return { ok: true as const, messages };
  } catch (error) {
    logger.error('[gmail] listEmails failed', {
      userId,
      query: args.query,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}

export type GetEmailArgs = { messageId: string };

export async function getEmail(userId: string, args: GetEmailArgs) {
  const account = await getPrimaryAccountForFeature(userId, 'email');
  if (account?.provider === 'microsoft') return getMicrosoftEmailForAccount(account, args);
  if (account?.provider === 'google') return getGoogleEmailForAccount(account, args);

  const gmail = await clientForUser(userId);
  if (!gmail) return { ok: false as const, error: 'not_connected' };

  try {
    const { data: msg } = await gmail.users.messages.get({
      userId: 'me',
      id: args.messageId,
      format: 'full',
    });

    const summary = normalizeGoogleSummary(msg, { id: null, email: null });
    const fullBody = extractBody(msg.payload);
    const bodyTruncated = fullBody.length > MAX_BODY_CHARS;
    const body = bodyTruncated ? fullBody.slice(0, MAX_BODY_CHARS) : fullBody;

    const detail: EmailDetail = { ...summary, body, bodyTruncated };
    return { ok: true as const, email: detail };
  } catch (error) {
    logger.error('[gmail] getEmail failed', {
      userId,
      messageId: args.messageId,
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
