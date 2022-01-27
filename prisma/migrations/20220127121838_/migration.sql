/*
  Warnings:

  - You are about to drop the column `lastReadNotificationID` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastReadNotificationID",
ADD COLUMN     "lastReadNotification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
