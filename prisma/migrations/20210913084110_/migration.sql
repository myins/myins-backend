-- DropForeignKey
ALTER TABLE "PostContent" DROP CONSTRAINT "PostContent_postId_fkey";

-- AlterTable
ALTER TABLE "CurrentVersions" ADD COLUMN     "link" TEXT NOT NULL DEFAULT E'';

-- AddForeignKey
ALTER TABLE "PostContent" ADD CONSTRAINT "PostContent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
