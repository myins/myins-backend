-- AlterTable
ALTER TABLE "INS" DROP COLUMN IF EXISTS     "invitedPhoneNumbers";
ALTER TABLE "INS" ADD COLUMN     "invitedPhoneNumbers" TEXT[];

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "pending" SET DEFAULT true;
