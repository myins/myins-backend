import { Prisma } from '.prisma/client';

const commentWithPostWithInsesData = (userId: string) => {
  return {
    post: {
      include: {
        inses: {
          where: {
            members: {
              some: {
                userId: userId,
              },
            },
          },
        },
      },
    },
  };
};

export const CommentWithPostWithInsesInclude = (
  userID: string,
): Prisma.CommentInclude => {
  return commentWithPostWithInsesData(userID);
};

const commentWithPostWithInses = Prisma.validator<Prisma.CommentArgs>()({
  include: commentWithPostWithInsesData(''),
});
export type CommentWithPostWithInses = Prisma.CommentGetPayload<
  typeof commentWithPostWithInses
>;
