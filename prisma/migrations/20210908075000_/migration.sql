-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "UserInsConnection" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT E'MEMBER';
