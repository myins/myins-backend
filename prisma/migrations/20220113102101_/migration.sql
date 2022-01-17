-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "storyMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_storyMediaId_fkey" FOREIGN KEY ("storyMediaId") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
