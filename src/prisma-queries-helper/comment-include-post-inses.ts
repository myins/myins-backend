import { Prisma } from '.prisma/client';

const commentWithPostWithInsesIDData = {
  post: {
    select: {
      inses: {
        select: {
          id: true,
        },
      },
    },
  },
};
export const CommentWithPostWithInsesIDInclude: Prisma.CommentInclude =
  commentWithPostWithInsesIDData;

const commentWithPostWithInsesID = Prisma.validator<Prisma.CommentArgs>()({
  include: commentWithPostWithInsesIDData,
});
export type CommentWithPostWithInsesID = Prisma.CommentGetPayload<
  typeof commentWithPostWithInsesID
>;
