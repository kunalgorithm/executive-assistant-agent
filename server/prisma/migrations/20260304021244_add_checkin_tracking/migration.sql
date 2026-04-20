-- AlterTable
ALTER TABLE "users" ADD COLUMN     "checkin_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_checkin_at" TIMESTAMP(3);
