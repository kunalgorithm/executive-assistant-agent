import { z } from 'zod';

import { SENDBLUE_STATUS_MAP } from '@/utils/constants';

/**
 * Estimate how long a human would take to type a message (ms).
 * ~40-60ms per character with jitter, clamped to a reasonable range.
 */
export function typingDelayMs(text: string): number {
  const perChar = 40 + Math.random() * 20; // 40-60ms per char
  const base = text.length * perChar;
  return Math.min(Math.max(base, 800), 4000); // clamp 800ms – 4s
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

    // Split long lines on sentence boundaries (. ! ? followed by a space).
    // Uses a lookahead so the period stays attached to the preceding sentence.
    // Avoids breaking URLs (e.g. "johndoe.dev") since those periods aren't followed by a space.
    const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (!sentences) {
      chunks.push(line);
      continue;
    }

    // Group short sentences together so we don't send tiny fragments
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
  group_id: z.string().optional().default(''),
  participants: z.array(z.string()).optional().default([]),
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

const DUPLICATE_KEYS = ['message_handle', 'content', 'media_url', 'date_sent']; // Keys already stored as dedicated ChannelMessage columns
const UNNEEDED_KEYS = [
  'from_number',
  'to_number',
  'is_outbound',
  'plan',
  'accountEmail',
  'service',
  'date_updated',
  'message_type',
  'group_id',
  'participants',
]; // fields resolved to user relations

export function cleanSendblueData(data: object): object {
  const raw = { ...data } as Record<string, unknown>;
  for (const key of [...DUPLICATE_KEYS, ...UNNEEDED_KEYS]) {
    delete raw[key];
  }

  // Strip null/undefined values — only keep fields that actually have data
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null));
}

export const profileExtractionSchema = z.object({
  firstName: z.string().nullable().describe(`the user's first name if they mentioned it, or null.`),
  lastName: z
    .string()
    .nullable()
    .describe(
      `the user's last name if they mentioned it, or null. Only set this if they gave a full name (e.g. "I'm John Smith" → firstName: "John", lastName: "Smith").`,
    ),
  title: z
    .string()
    .nullable()
    .describe(
      `a short label for who they are — could be a job title ("Product Designer"), a passion ("Drone Cinematographer"), a description ("AI Tinkerer & Sci-Fi Nerd"), or null if not enough info yet.`,
    ),
  bio: z
    .string()
    .nullable()
    .describe(
      `a 1-2 sentence summary of what they're into, what they care about, or what they're looking for. null if not enough info.`,
    ),
  tags: z
    .array(z.string())
    .describe(
      `an array of interests, skills, hobbies, and topics they've mentioned (e.g., ["pickleball", "Star Trek", "AI", "building robots", "reading", "climate tech", "React"]). Include everything — professional, creative, and personal. Empty array if none.`,
    ),
  primaryIntent: z
    .enum(['hiring', 'looking_for_work', 'fundraising', 'investing', 'networking', 'mentorship', 'looking_for_mentor'])
    .nullable()
    .describe(
      `the user's primary reason for being here, inferred from what they said about what they're looking for or trying to do. Pick the single best match: "hiring" if they want to hire people, "looking_for_work" if they're job hunting, "fundraising" if they're raising capital, "investing" if they want to invest in startups/projects, "networking" if they want to expand their professional network or meet interesting people, "mentorship" if they want to mentor others, "looking_for_mentor" if they're seeking a mentor. null if not enough info to determine.`,
    ),
  hasEnoughForBackground: z
    .boolean()
    .describe(
      `true if you clearly know all three: (1) the user's first name (must not be null), (2) who they want to meet or what they're looking for, and (3) what they are trying to do right now. false if any of these are missing — especially the first name.`,
    ),
  hasEnoughForInterests: z
    .boolean()
    .describe(
      `true if you have at least 3 clear details across these areas: what they've done, where their superpowers are, what they know a lot about, and where they are most unique or strong. false otherwise.`,
    ),
  linkedinUrl: z
    .string()
    .nullable()
    .describe(
      `a LinkedIn profile URL if the user shared one. Look for linkedin.com links, or if they said something like "linkedin.com/in/johndoe" or just "/in/johndoe", normalize to the full URL. null if not shared.`,
    ),
  twitterUrl: z
    .string()
    .nullable()
    .describe(
      `a Twitter/X profile URL if the user shared one. Look for twitter.com or x.com links, or handles like "@johndoe" — normalize to "https://x.com/johndoe". null if not shared.`,
    ),
  instagramUrl: z
    .string()
    .nullable()
    .describe(
      `an Instagram profile URL if the user shared one. Look for instagram.com links, or handles like "@johndoe" — normalize to "https://instagram.com/johndoe". null if not shared.`,
    ),
  websiteUrl: z
    .string()
    .nullable()
    .describe(
      `a personal website or portfolio URL if the user shared one. Look for any non-social URL they shared (e.g. "mysite.com", "https://johndoe.dev"). null if not shared.`,
    ),
  hasSharedSocials: z
    .boolean()
    .describe(
      `true if the AI asked the user about sharing social links AND the user has replied — whether they shared links, said "no", "skip", "I don't have any", "nah", or gave ANY response at all to the ask. false ONLY if the user hasn't been asked yet or the last message in the conversation is the AI asking for socials (i.e. the user hasn't responded yet).`,
    ),
});
export type ProfileExtraction = z.infer<typeof profileExtractionSchema>;

export const checkinEnum = ['accepted', 'declined'] as const;
export const classifyCheckInResponseSchema = z.object({
  result: z
    .enum(checkinEnum)
    .optional()
    .nullable()
    .describe(
      `- "accepted": the user is interested in the introduction (e.g. "yes", "yeah sure", "sounds great", "i'd love to meet them", "down!", "let's do it", "interested", "for sure")
- "declined": the user is NOT interested (e.g. "no thanks", "not right now", "i'm good", "pass", "nah", "no")`,
    ),
  linkRequest: z
    .enum(['linkedin', 'X', 'twitter', 'instagram', 'website'])
    .optional()
    .nullable()
    .describe(`the platform the user requested to share their social link for`),
});
export type OptInClassificationResult = z.infer<typeof classifyCheckInResponseSchema>;

const reactionEnumForPickSchema = ['love', 'laugh', 'emphasize', 'none'] as const;
export type Reaction = (typeof reactionEnumForPickSchema)[number];

export const pickReactionSchema = z.object({
  reaction: z.enum(reactionEnumForPickSchema).nullable().describe(`React ONLY if this message is clearly one of these
- Genuinely funny or witty → "laugh"
- Exciting news or a heartfelt moment → "love"
- A major achievement or bold statement → "emphasize"`),
});
