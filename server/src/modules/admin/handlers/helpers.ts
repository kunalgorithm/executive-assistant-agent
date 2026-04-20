import { z } from 'zod';

import { MATCH_STATUSES } from '@/utils/constants';

const SORTABLE_FIELDS = ['status', 'lastMessageAt', 'checkinCount', 'createdAt'] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(SORTABLE_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const usersPaginationSchema = paginationSchema;

const MATCH_SORTABLE_FIELDS = ['score', 'createdAt'] as const;
const MATCH_STATUS_FILTERS = [...Object.keys(MATCH_STATUSES), 'all', 'others'] as const;

export const OTHERS_STATUSES = [
  MATCH_STATUSES.active,
  MATCH_STATUSES.expired,
  MATCH_STATUSES.reported,
  MATCH_STATUSES.pending,
];

export const matchesQuerySchema = paginationSchema.extend({
  sort: z.enum(MATCH_SORTABLE_FIELDS).default('score'),
  status: z.enum(MATCH_STATUS_FILTERS),
});

export const analyticsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  events: z.string().optional(),
  userIds: z.string().optional(),
  after: z.iso.datetime().optional(),
  before: z.iso.datetime().optional(),
});

export const introducePairSchema = z
  .object({ userAId: z.uuid(), userBId: z.uuid() })
  .refine((data) => data.userAId !== data.userBId, { message: 'Cannot introduce a user to themselves' });

export const introduceStartSchema = introducePairSchema;

export const updateDraftsSchema = z.object({
  draftMessageA: z.string().min(1).optional(),
  draftMessageB: z.string().min(1).optional(),
});

const userIdParamSchema = z.object({
  userId: z.uuid(),
});

export const getConversationSchema = userIdParamSchema;
export const handleRefreshUserMatchesSchema = userIdParamSchema;

export const conversationQuerySchema = z.object({
  cursor: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const toggleOptInSchema = z.object({
  userId: z.uuid(),
  optedIn: z.boolean(),
});

export const matchIdParamSchema = z.object({
  matchId: z.uuid(),
});

export const toggleOptInParamsSchema = matchIdParamSchema;

export const updateNotesSchema = z.object({
  notes: z.string(),
});

export const matchSelect = {
  id: true,
  userAId: true,
  userBId: true,
  status: true,
  score: true,
  intentScore: true,
  similarityScore: true,
  matchReason: true,
  groupId: true,
  draftMessageA: true,
  draftMessageB: true,
  userAOptedIn: true,
  userBOptedIn: true,
  userADeclined: true,
  userBDeclined: true,
  createdAt: true,
  updatedAt: true,
  userA: { select: { id: true, firstName: true, lastName: true, title: true, phoneNumber: true } },
  userB: { select: { id: true, firstName: true, lastName: true, title: true, phoneNumber: true } },
};

const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  bio: true,
  tags: true,
  primaryIntent: true,
  timezone: true,
  phoneNumber: true,
};

export const matchSelectWithProfiles = {
  id: true,
  status: true,
  score: true,
  intentScore: true,
  similarityScore: true,
  matchReason: true,
  groupId: true,
  draftMessageA: true,
  draftMessageB: true,
  userAOptedIn: true,
  userBOptedIn: true,
  userADeclined: true,
  userBDeclined: true,
  createdAt: true,
  updatedAt: true,
  userA: { select: profileSelect },
  userB: { select: profileSelect },
};

export const activeMatchStatuses = [
  MATCH_STATUSES.active,
  MATCH_STATUSES.notified,
  MATCH_STATUSES.ready,
  MATCH_STATUSES.awaiting_opt_in,
];
