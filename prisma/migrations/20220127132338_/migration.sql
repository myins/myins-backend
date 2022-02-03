/*
  Warnings:

  - You are about to drop the column `postId` on the `PostContent` table. All the data in the column will be lost.
  - You are about to drop the `PostInsConnection` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `insId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PostContent" DROP CONSTRAINT "PostContent_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostInsConnection" DROP CONSTRAINT "PostInsConnection_id_fkey";

-- DropForeignKey
ALTER TABLE "PostInsConnection" DROP CONSTRAINT "PostInsConnection_postId_fkey";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "insId" TEXT NOT NULL,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedByUsers" TEXT[];

-- AlterTable
ALTER TABLE "PostContent" DROP COLUMN "postId";

-- DropTable
DROP TABLE "PostInsConnection";

-- CreateTable
CREATE TABLE "_PostToPostContent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PostToPostContent_AB_unique" ON "_PostToPostContent"("A", "B");

-- CreateIndex
CREATE INDEX "_PostToPostContent_B_index" ON "_PostToPostContent"("B");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToPostContent" ADD FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToPostContent" ADD FOREIGN KEY ("B") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
