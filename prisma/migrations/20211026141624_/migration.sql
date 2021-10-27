/*
  Warnings:

  - The values [SHARED_POST] on the enum `NotificationSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationSource_new" AS ENUM ('LIKE_POST', 'COMMENT', 'LIKE_COMMENT');
ALTER TABLE "User" ALTER COLUMN "disabledNotifications" TYPE "NotificationSource_new"[] USING ("disabledNotifications"::text::"NotificationSource_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "source" TYPE "NotificationSource_new" USING ("source"::text::"NotificationSource_new");
ALTER TYPE "NotificationSource" RENAME TO "NotificationSource_old";
ALTER TYPE "NotificationSource_new" RENAME TO "NotificationSource";
DROP TYPE "NotificationSource_old";
COMMIT;
