-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "google_email" TEXT,
  ADD COLUMN "google_refresh_token" TEXT,
  ADD COLUMN "google_access_token" TEXT,
  ADD COLUMN "google_access_token_expires_at" TIMESTAMP(3),
  ADD COLUMN "calendar_connected_at" TIMESTAMP(3),
  ADD COLUMN "connect_token" TEXT,
  ADD COLUMN "connect_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_connect_token_key" ON "users"("connect_token");
