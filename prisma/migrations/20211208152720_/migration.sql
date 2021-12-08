/*
  Warnings:

  - Added the required column `totalMediaContent` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "totalMediaContent" INTEGER NOT NULL;
