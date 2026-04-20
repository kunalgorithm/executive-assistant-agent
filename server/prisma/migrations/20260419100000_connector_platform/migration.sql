-- CreateEnum
CREATE TYPE "ConnectorProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE', 'CALDAV', 'CARDDAV', 'TODOIST');

-- CreateEnum
CREATE TYPE "ConnectorDomain" AS ENUM ('CALENDAR', 'CONTACTS', 'TASKS', 'EMAIL');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'ERROR', 'REVOKED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXECUTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionLogStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'UNDONE');

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "ConnectorProvider" NOT NULL,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "account_email" TEXT,
    "account_name" TEXT,
    "external_account_id" TEXT NOT NULL,
    "access_token_ciphertext" TEXT,
    "refresh_token_ciphertext" TEXT,
    "id_token_ciphertext" TEXT,
    "token_type" TEXT,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "last_validated_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_resources" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connected_account_id" TEXT NOT NULL,
    "domain" "ConnectorDomain" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "parent_external_id" TEXT,
    "display_name" TEXT,
    "remote_url" TEXT,
    "etag" TEXT,
    "fingerprint" TEXT,
    "source_updated_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_aliases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connected_account_id" TEXT,
    "external_resource_id" TEXT,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "display_name" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connected_account_id" TEXT,
    "domain" "ConnectorDomain" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmation_token" TEXT NOT NULL,
    "summary" TEXT,
    "request_payload" JSONB NOT NULL,
    "proposed_result" JSONB,
    "expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connected_account_id" TEXT,
    "pending_action_id" TEXT,
    "domain" "ConnectorDomain" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "ActionLogStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "summary" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "undo_payload" JSONB,
    "undone_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_user_id_provider_external_account_id_key" ON "connected_accounts"("user_id", "provider", "external_account_id");

-- CreateIndex
CREATE INDEX "connected_accounts_user_id_provider_idx" ON "connected_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "connected_accounts_status_updated_at_idx" ON "connected_accounts"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_resources_connected_account_id_domain_external_id_key" ON "external_resources"("connected_account_id", "domain", "external_id");

-- CreateIndex
CREATE INDEX "external_resources_user_id_domain_resource_type_idx" ON "external_resources"("user_id", "domain", "resource_type");

-- CreateIndex
CREATE INDEX "external_resources_display_name_idx" ON "external_resources"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "person_aliases_user_id_normalized_alias_key" ON "person_aliases"("user_id", "normalized_alias");

-- CreateIndex
CREATE INDEX "person_aliases_connected_account_id_idx" ON "person_aliases"("connected_account_id");

-- CreateIndex
CREATE INDEX "person_aliases_external_resource_id_idx" ON "person_aliases"("external_resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_actions_confirmation_token_key" ON "pending_actions"("confirmation_token");

-- CreateIndex
CREATE INDEX "pending_actions_user_id_status_created_at_idx" ON "pending_actions"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "pending_actions_expires_at_idx" ON "pending_actions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "action_logs_pending_action_id_key" ON "action_logs"("pending_action_id");

-- CreateIndex
CREATE INDEX "action_logs_user_id_domain_created_at_idx" ON "action_logs"("user_id", "domain", "created_at");

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_external_resource_id_fkey" FOREIGN KEY ("external_resource_id") REFERENCES "external_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_pending_action_id_fkey" FOREIGN KEY ("pending_action_id") REFERENCES "pending_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
