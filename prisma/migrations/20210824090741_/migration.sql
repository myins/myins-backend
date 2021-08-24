/*
  Warnings:

  - You are about to drop the `_INSToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_INSToUser" DROP CONSTRAINT "_INSToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_INSToUser" DROP CONSTRAINT "_INSToUser_B_fkey";

-- DropTable
DROP TABLE "_INSToUser";

-- CreateTable
CREATE TABLE "UserInsConnection" (
    "userId" TEXT NOT NULL,
    "insId" TEXT NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId","insId")
);

-- AddForeignKey
ALTER TABLE "UserInsConnection" ADD FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInsConnection" ADD FOREIGN KEY ("insId") REFERENCES "INS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
