-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "draft_message_a" TEXT,
ADD COLUMN     "draft_message_b" TEXT,
ADD COLUMN     "user_a_opted_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "user_b_opted_in" BOOLEAN NOT NULL DEFAULT false;
