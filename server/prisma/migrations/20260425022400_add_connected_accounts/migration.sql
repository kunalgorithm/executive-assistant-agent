-- CreateEnum
CREATE TYPE "ConnectedAccountProvider" AS ENUM ('google', 'microsoft');

-- CreateTable
CREATE TABLE "connected_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "ConnectedAccountProvider" NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "email" TEXT,
  "display_name" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "refresh_token" TEXT,
  "access_token" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "calendar_connected_at" TIMESTAMP(3),
  "contacts_connected_at" TIMESTAMP(3),
  "tasks_connected_at" TIMESTAMP(3),
  "email_connected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- Backfill existing Google OAuth data into the normalized account table.
INSERT INTO "connected_accounts" (
  "id",
  "user_id",
  "provider",
  "provider_account_id",
  "email",
  "scopes",
  "refresh_token",
  "access_token",
  "access_token_expires_at",
  "calendar_connected_at",
  "contacts_connected_at",
  "tasks_connected_at",
  "email_connected_at",
  "created_at",
  "updated_at"
)
SELECT
  md5(random()::TEXT || clock_timestamp()::TEXT),
  "id",
  'google',
  COALESCE("google_email", "id"),
  "google_email",
  ARRAY[
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/gmail.readonly'
  ],
  "google_refresh_token",
  "google_access_token",
  "google_access_token_expires_at",
  "calendar_connected_at",
  "contacts_connected_at",
  "tasks_connected_at",
  "gmail_connected_at",
  "created_at",
  "updated_at"
FROM "users"
WHERE "google_refresh_token" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_provider_provider_account_id_key"
  ON "connected_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_provider_idx" ON "connected_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_calendar_connected_at_idx"
  ON "connected_accounts"("user_id", "calendar_connected_at");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_contacts_connected_at_idx"
  ON "connected_accounts"("user_id", "contacts_connected_at");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_tasks_connected_at_idx"
  ON "connected_accounts"("user_id", "tasks_connected_at");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_email_connected_at_idx"
  ON "connected_accounts"("user_id", "email_connected_at");

-- AddForeignKey
ALTER TABLE "connected_accounts"
  ADD CONSTRAINT "connected_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
