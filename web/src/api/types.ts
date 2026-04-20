export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type AdminUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  title: string | null;
  bio: string | null;
  isActive: boolean;
  adminNotes: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  email: string | null;
  timezone: string;
  updatedAt: string;
};

export type AdminMessage = {
  id: number;
  fromUserId: string | null;
  toUserId: string | null;
  content: string | null;
  mediaUrl: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type ConversationPage = {
  messages: AdminMessage[];
  nextCursor: number | null;
};

export type AnalyticsEvent = {
  id: string;
  event: string;
  userId: string | null;
  metadata: unknown;
  createdAt: string;
  user: Pick<AdminUser, 'id' | 'email' | 'firstName' | 'lastName' | 'phoneNumber'>;
};

export type AnalyticsFilters = {
  events?: string[];
  userIds?: string[];
  after?: string;
  before?: string;
};

export type AnalyticsPage = {
  events: AnalyticsEvent[];
  nextCursor: string | null;
  users: Record<string, string>;
};
