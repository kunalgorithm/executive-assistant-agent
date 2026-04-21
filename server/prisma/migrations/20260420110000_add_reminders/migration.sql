-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('scheduled', 'processing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReminderCategory" AS ENUM ('general', 'birthday', 'event', 'conflict', 'busy_time');

-- CreateEnum
CREATE TYPE "ReminderRecurrence" AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "category" "ReminderCategory" NOT NULL DEFAULT 'general',
    "status" "ReminderStatus" NOT NULL DEFAULT 'scheduled',
    "recurrence" "ReminderRecurrence" NOT NULL DEFAULT 'none',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "last_sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_user_id_status_idx" ON "reminders"("user_id", "status");

-- CreateIndex
CREATE INDEX "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

-- CreateIndex
CREATE INDEX "reminders_category_remind_at_idx" ON "reminders"("category", "remind_at");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
