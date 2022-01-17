/*
  Warnings:

  - You are about to drop the `_ViewsStoryMediaToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ViewsStoryMediaToUser" DROP CONSTRAINT "_ViewsStoryMediaToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ViewsStoryMediaToUser" DROP CONSTRAINT "_ViewsStoryMediaToUser_B_fkey";

-- DropTable
DROP TABLE "_ViewsStoryMediaToUser";

-- CreateTable
CREATE TABLE "UserStoryMediaViewConnection" (
    "id" TEXT NOT NULL,
    "storyMediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStoryMediaViewConnection_pkey" PRIMARY KEY ("id","storyMediaId")
);

-- AddForeignKey
ALTER TABLE "UserStoryMediaViewConnection" ADD CONSTRAINT "UserStoryMediaViewConnection_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryMediaViewConnection" ADD CONSTRAINT "UserStoryMediaViewConnection_storyMediaId_fkey" FOREIGN KEY ("storyMediaId") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
