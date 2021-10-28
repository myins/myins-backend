/*
  Warnings:

  - The values [POST,ADDED_PHOTOS,MESSAGE,JOINED_INS,SOMEONE_JOINED_INS,JOIN_INS_REJECTED] on the enum `NotificationSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `insId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `photoCount` on the `Notification` table. All the data in the column will be lost.
  - Made the column `targetId` on table `Notification` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationSource_new" AS ENUM ('LIKE_POST', 'LIKE_COMMENT', 'COMMENT');
ALTER TABLE "User" ALTER COLUMN "disabledNotifications" TYPE "NotificationSource_new"[] USING ("disabledNotifications"::text::"NotificationSource_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "source" TYPE "NotificationSource_new" USING ("source"::text::"NotificationSource_new");
ALTER TYPE "NotificationSource" RENAME TO "NotificationSource_old";
ALTER TYPE "NotificationSource_new" RENAME TO "NotificationSource";
DROP TYPE "NotificationSource_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_insId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "insId",
DROP COLUMN "photoCount",
ALTER COLUMN "targetId" SET NOT NULL;
