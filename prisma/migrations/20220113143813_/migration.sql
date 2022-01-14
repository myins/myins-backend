/*
  Warnings:

  - You are about to drop the `_INSToStory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_INSToStory" DROP CONSTRAINT "_INSToStory_A_fkey";

-- DropForeignKey
ALTER TABLE "_INSToStory" DROP CONSTRAINT "_INSToStory_B_fkey";

-- DropTable
DROP TABLE "_INSToStory";

-- CreateTable
CREATE TABLE "StoryInsConnection" (
    "storyId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryInsConnection_pkey" PRIMARY KEY ("storyId","id")
);

-- AddForeignKey
ALTER TABLE "StoryInsConnection" ADD CONSTRAINT "StoryInsConnection_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryInsConnection" ADD CONSTRAINT "StoryInsConnection_id_fkey" FOREIGN KEY ("id") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
