-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "user_a_declined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "user_b_declined" BOOLEAN NOT NULL DEFAULT false;
