-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "intent_score" DOUBLE PRECISION,
ADD COLUMN     "match_reason" TEXT,
ADD COLUMN     "similarity_score" DOUBLE PRECISION;

-- Migrate legacy "matched" users: if substatus is a known onboarding substatus, revert to onboarding
UPDATE "users"
SET status = 'onboarding'
WHERE status = 'matched'
  AND substatus IN ('collecting_background', 'collecting_interests', 'collecting_socials', 'generating_embedding');

-- Remaining "matched" users (NULL or unknown substatus) completed onboarding — set to ready_to_match
UPDATE "users"
SET status = 'ready_to_match', substatus = NULL
WHERE status = 'matched';
