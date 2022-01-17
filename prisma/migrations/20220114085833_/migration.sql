/*
  Warnings:

  - You are about to drop the `_INSToPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_INSToPost" DROP CONSTRAINT "_INSToPost_A_fkey";

-- DropForeignKey
ALTER TABLE "_INSToPost" DROP CONSTRAINT "_INSToPost_B_fkey";

-- DropTable
DROP TABLE "_INSToPost";

-- CreateTable
CREATE TABLE "PostInsConnection" (
    "postId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReported" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostInsConnection_pkey" PRIMARY KEY ("postId","id")
);

-- AddForeignKey
ALTER TABLE "PostInsConnection" ADD CONSTRAINT "PostInsConnection_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostInsConnection" ADD CONSTRAINT "PostInsConnection_id_fkey" FOREIGN KEY ("id") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
