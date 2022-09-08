-- CreateEnum
CREATE TYPE "PostCreatedFrom" AS ENUM ('HOME', 'INS', 'STORY');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "createdFrom" "PostCreatedFrom" NOT NULL DEFAULT E'HOME';
