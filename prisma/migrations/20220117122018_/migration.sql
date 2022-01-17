/*
  Warnings:

  - The primary key for the `UserStoryMediaLikeConnection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `UserStoryMediaViewConnection` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "UserStoryMediaLikeConnection" DROP CONSTRAINT "UserStoryMediaLikeConnection_pkey",
ADD CONSTRAINT "UserStoryMediaLikeConnection_pkey" PRIMARY KEY ("id", "storyMediaId", "insId");

-- AlterTable
ALTER TABLE "UserStoryMediaViewConnection" DROP CONSTRAINT "UserStoryMediaViewConnection_pkey",
ADD CONSTRAINT "UserStoryMediaViewConnection_pkey" PRIMARY KEY ("id", "storyMediaId", "insId");
