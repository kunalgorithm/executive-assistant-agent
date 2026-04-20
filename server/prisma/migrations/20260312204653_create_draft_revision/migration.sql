-- CreateTable
CREATE TABLE "draft_revisions" (
    "id" SERIAL NOT NULL,
    "match_id" TEXT NOT NULL,
    "ai_draft_a" TEXT NOT NULL,
    "ai_draft_b" TEXT NOT NULL,
    "admin_draft_a" TEXT,
    "admin_draft_b" TEXT,
    "context" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "draft_revisions_match_id_key" ON "draft_revisions"("match_id");

-- AddForeignKey
ALTER TABLE "draft_revisions" ADD CONSTRAINT "draft_revisions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
