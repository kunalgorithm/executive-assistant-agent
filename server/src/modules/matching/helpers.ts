export const userForMatchingSelect = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  bio: true,
  tags: true,
  primaryIntent: true,
  phoneNumber: true,
  status: true,
};

export type UserForMatching = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  bio: string | null;
  tags: string[];
  primaryIntent: string | null;
  phoneNumber: string | null;
};

export type ScoredCandidate = {
  user: UserForMatching;
  score: number;
  intentScore: number;
  similarityScore: number;
};
