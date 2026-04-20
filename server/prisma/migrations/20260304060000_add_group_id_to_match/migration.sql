-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "group_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "matches_group_id_key" ON "matches"("group_id");
