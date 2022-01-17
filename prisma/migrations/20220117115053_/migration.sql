/*
  Warnings:

  - Added the required column `insId` to the `UserStoryMediaLikeConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `insId` to the `UserStoryMediaViewConnection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserStoryMediaLikeConnection" ADD COLUMN     "insId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserStoryMediaViewConnection" ADD COLUMN     "insId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "UserStoryMediaViewConnection" ADD CONSTRAINT "UserStoryMediaViewConnection_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryMediaLikeConnection" ADD CONSTRAINT "UserStoryMediaLikeConnection_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
