-- CreateEnum
CREATE TYPE "StoryStickerType" AS ENUM ('TEXT', 'LOCATION', 'IMAGE');

-- CreateTable
CREATE TABLE "StoryStickers" (
    "id" TEXT NOT NULL,
    "storyMediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "StoryStickerType" NOT NULL,
    "normalizedX" DECIMAL(65,30) NOT NULL,
    "normalizedY" DECIMAL(65,30) NOT NULL,
    "normalizedWidth" DECIMAL(65,30) NOT NULL,
    "normalizedHeight" DECIMAL(65,30) NOT NULL,
    "value" TEXT NOT NULL,
    "subType" TEXT,
    "rotation" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "StoryStickers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StoryStickers" ADD CONSTRAINT "StoryStickers_storyMediaId_fkey" FOREIGN KEY ("storyMediaId") REFERENCES "PostContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
