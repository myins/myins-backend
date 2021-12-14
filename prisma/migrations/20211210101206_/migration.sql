/*
  Warnings:

  - You are about to drop the `_LikesStoryToUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ViewsStoryToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_LikesStoryToUser" DROP CONSTRAINT "_LikesStoryToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_LikesStoryToUser" DROP CONSTRAINT "_LikesStoryToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "_ViewsStoryToUser" DROP CONSTRAINT "_ViewsStoryToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ViewsStoryToUser" DROP CONSTRAINT "_ViewsStoryToUser_B_fkey";

-- DropTable
DROP TABLE "_LikesStoryToUser";

-- DropTable
DROP TABLE "_ViewsStoryToUser";

-- CreateTable
CREATE TABLE "_LikesStoryMediaToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ViewsStoryMediaToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LikesStoryMediaToUser_AB_unique" ON "_LikesStoryMediaToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_LikesStoryMediaToUser_B_index" ON "_LikesStoryMediaToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ViewsStoryMediaToUser_AB_unique" ON "_ViewsStoryMediaToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ViewsStoryMediaToUser_B_index" ON "_ViewsStoryMediaToUser"("B");

-- AddForeignKey
ALTER TABLE "_LikesStoryMediaToUser" ADD FOREIGN KEY ("A") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LikesStoryMediaToUser" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewsStoryMediaToUser" ADD FOREIGN KEY ("A") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewsStoryMediaToUser" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
