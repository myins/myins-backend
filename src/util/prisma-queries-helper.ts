import { Prisma } from '@prisma/client';

export const ShallowUserSelect: Prisma.UserSelect = {
  firstName: true,
  lastName: true,
  profilePicture: true,
  id: true,
};

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
export const CommentWithPostWithInsesInclude: Prisma.CommentInclude =
  commentWithPostWithInsesIDData;

const commentWithPostWithInsesID = Prisma.validator<Prisma.CommentArgs>()({
  include: commentWithPostWithInsesIDData,
});
export type CommentWithPostWithInsesID = Prisma.CommentGetPayload<
  typeof commentWithPostWithInsesID
>;
