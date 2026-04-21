import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

import { logger } from '@/utils/log';
import { getAccessTokenForUser } from './oauth';

export type EmailSummary = {
  messageId: string;
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

async function clientForUser(userId: string) {
  const accessToken = await getAccessTokenForUser(userId);
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

function normalizeSummary(msg: gmail_v1.Schema$Message): EmailSummary {
  const headers = msg.payload?.headers ?? [];
  const labels = msg.labelIds ?? [];
  return {
    messageId: msg.id ?? '',
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

  const stripHtml = (html: string): string =>
    html
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

export type ListEmailsArgs = {
  query?: string;
  maxResults?: number;
};

export async function listEmails(userId: string, args: ListEmailsArgs) {
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

    const messages = details.map((d) => normalizeSummary(d.data));
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
  const gmail = await clientForUser(userId);
  if (!gmail) return { ok: false as const, error: 'not_connected' };

  try {
    const { data: msg } = await gmail.users.messages.get({
      userId: 'me',
      id: args.messageId,
      format: 'full',
    });

    const summary = normalizeSummary(msg);
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
