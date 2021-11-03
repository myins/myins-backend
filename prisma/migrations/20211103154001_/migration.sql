-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAllBiometry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disabledBiometryINSIds" TEXT[];
