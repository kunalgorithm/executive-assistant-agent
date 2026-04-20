import { z } from 'zod';

const SORTABLE_FIELDS = ['lastMessageAt', 'createdAt'] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(SORTABLE_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const usersPaginationSchema = paginationSchema;

export const analyticsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  events: z.string().optional(),
  userIds: z.string().optional(),
  after: z.iso.datetime().optional(),
  before: z.iso.datetime().optional(),
});

const userIdParamSchema = z.object({
  userId: z.uuid(),
});

export const getConversationSchema = userIdParamSchema;

export const conversationQuerySchema = z.object({
  cursor: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateNotesSchema = z.object({
  notes: z.string(),
});
