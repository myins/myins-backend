-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "insId" TEXT,
ADD COLUMN     "photoCount" INTEGER,
ALTER COLUMN "targetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
