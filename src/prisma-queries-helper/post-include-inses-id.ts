import { Prisma } from '.prisma/client';

const postWithInsesIdData = {
  inses: {
    select: {
      id: true,
    },
  },
};
export const PostWithInsesIdInclude: Prisma.PostInclude = postWithInsesIdData;

const postWithInsesId = Prisma.validator<Prisma.PostArgs>()({
  include: postWithInsesIdData,
});
export type PostWithInsesId = Prisma.PostGetPayload<typeof postWithInsesId>;
