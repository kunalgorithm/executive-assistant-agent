import { z } from 'zod';

import { SENDBLUE_STATUS_MAP } from '@/utils/constants';

/**
 * Estimate how long a human would take to type a message (ms).
 * ~40-60ms per character with jitter, clamped to a reasonable range.
 */
export function typingDelayMs(text: string): number {
  const perChar = 40 + Math.random() * 20;
  const base = text.length * perChar;
  return Math.min(Math.max(base, 800), 4000);
}

/**
 * Split a long AI response into multiple short texts, like how people actually text.
 * Splits on newlines first, then on sentence boundaries for long chunks (>120 chars)
 * so messages never get truncated by Sendblue.
 */
export function splitIntoTexts(content: string): string[] {
  const lines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const line of lines) {
    if (line.length <= 120) {
      chunks.push(line);
      continue;
    }

    const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (!sentences) {
      chunks.push(line);
      continue;
    }

    let current = '';
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (current && (current + ' ' + trimmed).length > 120) {
        chunks.push(current);
        current = trimmed;
      } else {
        current = current ? current + ' ' + trimmed : trimmed;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [content];
}

export const sendblueInboundWebhookSchema = z.object({
  message_handle: z.string(),
  from_number: z.string(),
  to_number: z.string(),
  content: z.string().nullable().optional(),
  is_outbound: z.boolean(),
  service: z.string().optional(),
  date_sent: z.string().optional(),
  date_updated: z.string().optional(),
  media_url: z.string().nullable().optional(),
  error_code: z.union([z.string(), z.number()]).nullable().optional(),
  error_message: z.string().nullable().optional(),
  was_downgraded: z.boolean().nullable().optional(),
  accountEmail: z.string().optional(),
  plan: z.string().optional(),
  message_type: z.string().optional().default('message'),
});

export type SendblueInboundPayload = z.infer<typeof sendblueInboundWebhookSchema>;

export const sendblueStatusCallbackSchema = z.object({
  message_handle: z.string(),
  status: z.string(),
  error_code: z.union([z.string(), z.number()]).nullable().optional(),
  error_message: z.string().nullable().optional(),
  date_updated: z.string().optional(),
  was_downgraded: z.boolean().nullable().optional(),
});

export type SendblueStatusPayload = z.infer<typeof sendblueStatusCallbackSchema>;

export function mapSendblueStatus(status: string): string {
  return SENDBLUE_STATUS_MAP[status.toUpperCase()] || 'queued';
}

const DUPLICATE_KEYS = ['message_handle', 'content', 'media_url', 'date_sent'];
const UNNEEDED_KEYS = [
  'from_number',
  'to_number',
  'is_outbound',
  'plan',
  'accountEmail',
  'service',
  'date_updated',
  'message_type',
];

export function cleanSendblueData(data: object): object {
  const raw = { ...data } as Record<string, unknown>;
  for (const key of [...DUPLICATE_KEYS, ...UNNEEDED_KEYS]) {
    delete raw[key];
  }

  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null));
}

const reactionEnumForPickSchema = ['love', 'laugh', 'emphasize', 'none'] as const;
export type Reaction = (typeof reactionEnumForPickSchema)[number];

export const pickReactionSchema = z.object({
  reaction: z.enum(reactionEnumForPickSchema).nullable().describe(`React ONLY if this message is clearly one of these
- Genuinely funny or witty → "laugh"
- Exciting news or a heartfelt moment → "love"
- A major achievement or bold statement → "emphasize"`),
});
