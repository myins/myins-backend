/*
  Warnings:

  - You are about to drop the column `isHighlight` on the `Story` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "_LikesStoryToUser" DROP CONSTRAINT "_LikesStoryToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ViewsStoryToUser" DROP CONSTRAINT "_ViewsStoryToUser_A_fkey";

-- AlterTable
ALTER TABLE "PostContent" ADD COLUMN     "isHighlight" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Story" DROP COLUMN "isHighlight";

-- AddForeignKey
ALTER TABLE "_LikesStoryToUser" ADD FOREIGN KEY ("A") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewsStoryToUser" ADD FOREIGN KEY ("A") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
