/*
  Warnings:

  - Added the required column `totalMediaContent` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalMediaContent" INTEGER NOT NULL;
