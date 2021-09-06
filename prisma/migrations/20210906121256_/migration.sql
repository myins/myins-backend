-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastAcceptedPrivacyPolicyVersion" TIMESTAMP(3),
ADD COLUMN     "lastAcceptedTermsAndConditionsVersion" TIMESTAMP(3);
