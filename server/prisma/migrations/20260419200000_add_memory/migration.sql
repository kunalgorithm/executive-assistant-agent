-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('SCHEDULING', 'PEOPLE', 'COMMUNICATION', 'WORK_CONTEXT');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('SEMANTIC', 'EPISODIC');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('USER_EXPLICIT', 'USER_INFERRED', 'ACTION_LOG', 'SYSTEM');

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "embedding" vector(768),
    "entities" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "MemorySource" NOT NULL,
    "superseded_by_id" TEXT,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_user_id_status_memory_type_idx" ON "memories"("user_id", "status", "memory_type");

-- CreateIndex
CREATE INDEX "memories_user_id_category_status_idx" ON "memories"("user_id", "category", "status");

-- CreateIndex
CREATE INDEX "memories_expires_at_idx" ON "memories"("expires_at");

-- CreateIndex (ivfflat vector index for cosine similarity search)
CREATE INDEX "memories_embedding_idx" ON "memories" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- CreateIndex (full-text search index on content)
CREATE INDEX "memories_content_fts_idx" ON "memories" USING gin (to_tsvector('english', content));

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
