/*
  Warnings:

  - A unique constraint covering the columns `[shareCode]` on the table `INS` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "INS.shareCode_unique" ON "INS"("shareCode");
