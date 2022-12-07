-- CreateEnum
CREATE TYPE "ReactionsType" AS ENUM ('LIKE', 'LAUGH', 'HAPPY', 'ANGRY', 'APPLAUSE', 'SAD', 'SHY');

-- AlterTable
ALTER TABLE "UserStoryMediaLikeConnection" ADD COLUMN     "reaction_type" "ReactionsType" NOT NULL DEFAULT E'LIKE';
