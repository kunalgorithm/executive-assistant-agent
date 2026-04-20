import { env } from '@/utils/env';

export const PRIMARY_INTENTS = {
  hiring: { label: 'Hiring', compatibleWith: ['looking_for_work', 'networking', 'investing', 'mentorship'] },
  looking_for_work: {
    label: 'Looking for Work',
    compatibleWith: ['hiring', 'networking', 'mentorship', 'looking_for_mentor'],
  },
  fundraising: { label: 'Fundraising', compatibleWith: ['investing', 'networking', 'mentorship'] },
  investing: { label: 'Investing', compatibleWith: ['fundraising', 'networking', 'hiring', 'mentorship'] },
  networking: {
    label: 'Networking',
    compatibleWith: ['hiring', 'looking_for_work', 'fundraising', 'investing', 'networking', 'mentorship'],
  },
  mentorship: {
    label: 'Mentorship',
    compatibleWith: ['looking_for_mentor', 'networking', 'hiring', 'investing', 'fundraising'],
  },
  looking_for_mentor: {
    label: 'Looking for a Mentor',
    compatibleWith: ['mentorship', 'networking', 'looking_for_work'],
  },
} as const;

export type PrimaryIntent = keyof typeof PRIMARY_INTENTS;

export const USER_STATUSES = {
  onboarding: {
    label: 'onboarding',
    substates: {
      collecting_background: 'collecting_background',
      collecting_interests: 'collecting_interests',
      collecting_socials: 'collecting_socials',
      generating_embedding: 'generating_embedding',
    },
  },
  ready_to_match: { label: 'ready_to_match', substates: {} },
  inactive: { label: 'inactive', substates: {} },
} as const;

export type UserStatus = keyof typeof USER_STATUSES;
export type OnboardingSubstatus = keyof (typeof USER_STATUSES)['onboarding']['substates'];

export const MATCH_STATUSES = {
  suggested: 'suggested',
  rejected: 'rejected',
  drafting: 'drafting',
  awaiting_opt_in: 'awaiting_opt_in',
  ready: 'ready',
  pending: 'pending',
  notified: 'notified',
  active: 'active',
  expired: 'expired',
  reported: 'reported',
} as const;

export type MatchStatus = keyof typeof MATCH_STATUSES;

export const SENDBLUE_STATUS_MAP: Record<string, string> = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  ERROR: 'failed',
  UNDELIVERED: 'undelivered',
};

export const SMS_TEMPLATES = {
  NUDGE: 'Hey! Still want to finish setting up? Just reply to pick up where we left off.',
  GROUP_INTRO: (nameA: string, titleA: string, nameB: string, titleB: string) =>
    `hey! i wanted to introduce you two 🤝\n\n${nameA} — ${titleA}\n${nameB} — ${titleB}\n\ni think you'd really hit it off. say hi!`,
  MATCH_NOTIFICATION: (name: string, matchName: string, magicLink: string) =>
    `hey ${name}! i just introduced you to ${matchName} in a group chat 🤝 you can also chat here if you prefer: ${magicLink}`,
  NO_MATCH_REASSURANCE: 'Still looking for your perfect match! Hang tight.',
  UNKNOWN_NUMBER_REPLY: (onboardUrl: string) =>
    `Hey! Looks like you haven't signed up yet. Get started here: ${onboardUrl}`,
  WELCOME_INTRO: "hi! i'm sayla. i find the people who will actually move the needle for you.",
  WELCOME_QUESTION: "let's get into it — what's your full name?",
  WELCOME_CONTACT_CARD_URL: 'https://bamyourehired.s3.us-east-1.amazonaws.com/sayla.vcf',
} as const;

export const REF_ID_PATTERN = /\[ref:\s*([^\]]+)\]/i;

export const NUDGE_COOLDOWN_HOURS = 24;
export const NUDGE_TIMEOUT_HOURS = 2;
export const NO_MATCH_CYCLE_THRESHOLD = 3;

export const CHECKIN_CADENCE_BASE_DAYS = [2, 2, 3]; // base days between check-ins (jitter applied at runtime)
export const CHECKIN_JITTER_HOURS = 18; // +0 to 18 hours of random delay on top of base

export const MESSAGE_TYPES = { direct: 'direct', group: 'group' } as const;
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const SAYLA_COMMAND_PREFIX = '/sayla';

export const GEMINI_FLASH3_MODEL = 'gemini-3-flash-preview';

export const WEBHOOK_STATUS_CALLBACK_URL = `${env.SENDBLUE_WEBHOOK_BASE_URL}/api/messaging/webhook/status`;
