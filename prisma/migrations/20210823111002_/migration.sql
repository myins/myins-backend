/*
  Warnings:

  - Made the column `createdAt` on table `PostContent` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PostContent" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
