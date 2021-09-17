-- DropForeignKey
ALTER TABLE "UserInsConnection" DROP CONSTRAINT "UserInsConnection_insId_fkey";

-- DropForeignKey
ALTER TABLE "UserInsConnection" DROP CONSTRAINT "UserInsConnection_userId_fkey";

-- AddForeignKey
ALTER TABLE "UserInsConnection" ADD CONSTRAINT "UserInsConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInsConnection" ADD CONSTRAINT "UserInsConnection_insId_fkey" FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
