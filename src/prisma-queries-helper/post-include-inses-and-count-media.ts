import { Prisma } from '.prisma/client';

const postWithInsesAndCountMediaData = {
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
export const PostWithInsesAndCountMediaInclude: Prisma.PostInclude =
  postWithInsesAndCountMediaData;

const postWithInsesAndCountMedia = Prisma.validator<Prisma.PostArgs>()({
  include: postWithInsesAndCountMediaData,
});
export type PostWithInsesAndCountMedia = Prisma.PostGetPayload<
  typeof postWithInsesAndCountMedia
>;
