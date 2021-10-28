-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationSource" ADD VALUE 'POST';
ALTER TYPE "NotificationSource" ADD VALUE 'ADDED_PHOTOS';
ALTER TYPE "NotificationSource" ADD VALUE 'JOINED_INS';
ALTER TYPE "NotificationSource" ADD VALUE 'JOIN_INS_REJECTED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "insId" TEXT,
ADD COLUMN     "photoCount" INTEGER,
ALTER COLUMN "targetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
