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
  status: string;
  substatus: string | null;
  title: string | null;
  bio: string | null;
  tags: string[];
  primaryIntent: string | null;
  isActive: boolean;
  adminNotes: string | null;
  checkinCount: number;
  lastMessageAt: string | null;
  lastCheckinAt: string | null;
  createdAt: string;
  email: string | null;
  instagramUrl: string | null;
  lastNudgeAt: string | null;
  linkedinUrl: string | null;
  timezone: string;
  twitterUrl: string | null;
  websiteUrl: string | null;
  updatedAt: string;

  hasActiveMatches: boolean;
  matchCount: number;
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

type AdminMatchUser = Pick<
  AdminUser,
  'id' | 'firstName' | 'lastName' | 'title' | 'bio' | 'tags' | 'primaryIntent' | 'timezone' | 'phoneNumber'
>;

export type AdminMatch = {
  id: string;
  userA: AdminMatchUser;
  userB: AdminMatchUser;
  status: string;
  score: number | null;
  intentScore: number | null;
  similarityScore: number | null;
  matchReason: string | null;
  groupId: string | null;
  draftMessageA: string | null;
  draftMessageB: string | null;
  userAOptedIn: boolean;
  userBOptedIn: boolean;
  userADeclined: boolean;
  userBDeclined: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompatibilityCheck = {
  warnings: string[];
  intentCompatible: boolean;
  similarityScore: number | null;
  userA: { status: string; primaryIntent: string | null };
  userB: { status: string; primaryIntent: string | null };
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
