/*
  Warnings:

  - You are about to drop the column `isReported` on the `PostInsConnection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PostInsConnection" DROP COLUMN "isReported",
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedByUsers" TEXT[];
