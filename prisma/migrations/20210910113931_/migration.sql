/*
  Warnings:

  - The primary key for the `CurrentVersions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `CurrentVersions` table. All the data in the column will be lost.
  - You are about to drop the column `privacyPolicyVersion` on the `CurrentVersions` table. All the data in the column will be lost.
  - You are about to drop the column `termsAndConditionsVersion` on the `CurrentVersions` table. All the data in the column will be lost.
  - Added the required column `type` to the `CurrentVersions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_AND_CONDITIONS');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "CurrentVersions" DROP CONSTRAINT "CurrentVersions_pkey",
DROP COLUMN "id",
DROP COLUMN "privacyPolicyVersion",
DROP COLUMN "termsAndConditionsVersion",
ADD COLUMN     "type" "DocumentType" NOT NULL,
ADD CONSTRAINT "CurrentVersions_pkey" PRIMARY KEY ("type");

-- RenameIndex
ALTER INDEX "INS.shareCode_unique" RENAME TO "INS_shareCode_key";

-- RenameIndex
ALTER INDEX "User.phoneNumber_unique" RENAME TO "User_phoneNumber_key";
