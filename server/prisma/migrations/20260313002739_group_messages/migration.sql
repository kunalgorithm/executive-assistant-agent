-- AlterTable
ALTER TABLE "channel_messages" ADD COLUMN     "match_id" TEXT,
ADD COLUMN     "message_type" TEXT NOT NULL DEFAULT 'direct';

-- CreateIndex
CREATE INDEX "channel_messages_match_id_idx" ON "channel_messages"("match_id");

-- AddForeignKey
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
