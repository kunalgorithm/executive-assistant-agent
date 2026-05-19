-- Recover environments where connected_accounts was created outside Prisma or by a partial deploy.
DO $$
BEGIN
  CREATE TYPE "ConnectedAccountProvider" AS ENUM ('google', 'microsoft');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ConnectedAccountProvider" ADD VALUE IF NOT EXISTS 'microsoft';

CREATE TABLE IF NOT EXISTS "connected_accounts" (
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

ALTER TABLE "connected_accounts"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" "ConnectedAccountProvider",
  ADD COLUMN IF NOT EXISTS "provider_account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "access_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "calendar_connected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contacts_connected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tasks_connected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "email_connected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

DO $$
DECLARE
  provider_type TEXT;
BEGIN
  SELECT udt_name
  INTO provider_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'connected_accounts'
    AND column_name = 'provider';

  IF provider_type IS DISTINCT FROM 'ConnectedAccountProvider' THEN
    IF EXISTS (
      SELECT 1
      FROM "connected_accounts"
      WHERE LOWER("provider"::TEXT) NOT IN ('google', 'microsoft')
    ) THEN
      RAISE EXCEPTION 'Cannot recover connected_accounts with unsupported provider values';
    END IF;

    ALTER TABLE "connected_accounts"
      ALTER COLUMN "provider" DROP DEFAULT,
      ALTER COLUMN "provider" TYPE "ConnectedAccountProvider"
      USING LOWER("provider"::TEXT)::"ConnectedAccountProvider";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'connected_accounts'
      AND column_name = 'external_account_id'
  ) THEN
    UPDATE "connected_accounts"
    SET "provider_account_id" = COALESCE("provider_account_id", "external_account_id")
    WHERE "provider_account_id" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'connected_accounts'
      AND column_name = 'account_email'
  ) THEN
    UPDATE "connected_accounts"
    SET "email" = COALESCE("email", "account_email")
    WHERE "email" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'connected_accounts'
      AND column_name = 'account_name'
  ) THEN
    UPDATE "connected_accounts"
    SET "display_name" = COALESCE("display_name", "account_name")
    WHERE "display_name" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'connected_accounts'
      AND column_name = 'expires_at'
  ) THEN
    UPDATE "connected_accounts"
    SET "access_token_expires_at" = COALESCE("access_token_expires_at", "expires_at")
    WHERE "access_token_expires_at" IS NULL;
  END IF;
END $$;

UPDATE "connected_accounts"
SET
  "id" = COALESCE("id", md5(random()::TEXT || clock_timestamp()::TEXT)),
  "scopes" = COALESCE("scopes", ARRAY[]::TEXT[]),
  "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", CURRENT_TIMESTAMP);

ALTER TABLE "connected_accounts"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "user_id" SET NOT NULL,
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "provider_account_id" SET NOT NULL,
  ALTER COLUMN "scopes" SET NOT NULL,
  ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connected_accounts_pkey'
      AND conrelid = '"connected_accounts"'::regclass
  ) THEN
    ALTER TABLE "connected_accounts"
      ADD CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

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
WHERE "google_refresh_token" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "connected_accounts"
    WHERE "connected_accounts"."user_id" = "users"."id"
      AND "connected_accounts"."provider" = 'google'
  );

CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_provider_provider_account_id_key"
  ON "connected_accounts"("provider", "provider_account_id");

CREATE INDEX IF NOT EXISTS "connected_accounts_user_id_provider_idx" ON "connected_accounts"("user_id", "provider");

CREATE INDEX IF NOT EXISTS "connected_accounts_user_id_calendar_connected_at_idx"
  ON "connected_accounts"("user_id", "calendar_connected_at");

CREATE INDEX IF NOT EXISTS "connected_accounts_user_id_contacts_connected_at_idx"
  ON "connected_accounts"("user_id", "contacts_connected_at");

CREATE INDEX IF NOT EXISTS "connected_accounts_user_id_tasks_connected_at_idx"
  ON "connected_accounts"("user_id", "tasks_connected_at");

CREATE INDEX IF NOT EXISTS "connected_accounts_user_id_email_connected_at_idx"
  ON "connected_accounts"("user_id", "email_connected_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connected_accounts_user_id_fkey'
      AND conrelid = '"connected_accounts"'::regclass
  ) THEN
    ALTER TABLE "connected_accounts"
      ADD CONSTRAINT "connected_accounts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
