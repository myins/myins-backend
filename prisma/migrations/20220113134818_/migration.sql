/*
  Warnings:

  - You are about to drop the `_LikesStoryMediaToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_LikesStoryMediaToUser" DROP CONSTRAINT "_LikesStoryMediaToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_LikesStoryMediaToUser" DROP CONSTRAINT "_LikesStoryMediaToUser_B_fkey";

-- DropTable
DROP TABLE "_LikesStoryMediaToUser";

-- CreateTable
CREATE TABLE "UserStoryMediaLikeConnection" (
    "id" TEXT NOT NULL,
    "storyMediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStoryMediaLikeConnection_pkey" PRIMARY KEY ("id","storyMediaId")
);

-- AddForeignKey
ALTER TABLE "UserStoryMediaLikeConnection" ADD CONSTRAINT "UserStoryMediaLikeConnection_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryMediaLikeConnection" ADD CONSTRAINT "UserStoryMediaLikeConnection_storyMediaId_fkey" FOREIGN KEY ("storyMediaId") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
