/*
  Warnings:

  - You are about to drop the column `photoCount` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "photoCount",
ADD COLUMN     "metadata" JSONB;
