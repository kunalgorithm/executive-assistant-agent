/*
  Warnings:

  - You are about to drop the `room_messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "room_messages" DROP CONSTRAINT "room_messages_match_id_fkey";

-- DropForeignKey
ALTER TABLE "room_messages" DROP CONSTRAINT "room_messages_sender_id_fkey";

-- DropTable
DROP TABLE "room_messages";

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
