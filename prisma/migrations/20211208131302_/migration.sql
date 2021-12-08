-- AlterTable
ALTER TABLE "PostContent" ADD COLUMN     "storyId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "isHighlight" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LikesStoryToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ViewsStoryToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_INSToStory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LikesStoryToUser_AB_unique" ON "_LikesStoryToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_LikesStoryToUser_B_index" ON "_LikesStoryToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ViewsStoryToUser_AB_unique" ON "_ViewsStoryToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ViewsStoryToUser_B_index" ON "_ViewsStoryToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_INSToStory_AB_unique" ON "_INSToStory"("A", "B");

-- CreateIndex
CREATE INDEX "_INSToStory_B_index" ON "_INSToStory"("B");

-- AddForeignKey
ALTER TABLE "PostContent" ADD CONSTRAINT "PostContent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LikesStoryToUser" ADD FOREIGN KEY ("A") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LikesStoryToUser" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewsStoryToUser" ADD FOREIGN KEY ("A") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewsStoryToUser" ADD FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_INSToStory" ADD FOREIGN KEY ("A") REFERENCES "INS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_INSToStory" ADD FOREIGN KEY ("B") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
