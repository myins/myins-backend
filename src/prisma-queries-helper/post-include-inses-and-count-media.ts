import { Prisma } from '.prisma/client';

const postStoryWithInsesAndCountMediaData = {
  inses: {
    select: {
      id: true,
    },
  },
  _count: {
    select: {
      mediaContent: true,
    },
  },
};
export const PostStoryWithInsesAndCountMediaInclude:
  | Prisma.PostInclude
  | Prisma.StoryInclude = postStoryWithInsesAndCountMediaData;

const postStoryWithInsesAndCountMedia = Prisma.validator<
  Prisma.PostArgs | Prisma.StoryArgs
>()({
  include: postStoryWithInsesAndCountMediaData,
});
export type PostStoryWithInsesAndCountMedia =
  | Prisma.PostGetPayload<typeof postStoryWithInsesAndCountMedia>
  | Prisma.StoryGetPayload<typeof postStoryWithInsesAndCountMedia>;
