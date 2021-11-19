import { Prisma } from '.prisma/client';

const includePostWithInsesData = (userId: string) => {
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

const includeCommentWithPostWithInsesData = (userId: string) => {
  return {
    comment: {
      include: includePostWithInsesData(userId),
    },
  };
};

export const IncludePostWithInsesInclude = (
  userID: string,
): Prisma.CommentInclude | Prisma.UserPostLikeConnectionInclude => {
  return includePostWithInsesData(userID);
};

export const IncludeCommentWithPostWithInsesInclude = (
  userID: string,
): Prisma.UserCommentLikeConnectionInclude => {
  return includeCommentWithPostWithInsesData(userID);
};

const commentWithPostWithInses = Prisma.validator<Prisma.CommentArgs>()({
  include: includePostWithInsesData(''),
});
export type CommentWithPostWithInses = Prisma.CommentGetPayload<
  typeof commentWithPostWithInses
>;

const likePostWithPostWithInses =
  Prisma.validator<Prisma.UserPostLikeConnectionArgs>()({
    include: includePostWithInsesData(''),
  });
export type LikePostWithPostWithInses = Prisma.UserPostLikeConnectionGetPayload<
  typeof likePostWithPostWithInses
>;

const likeCommentWithPostWithInses =
  Prisma.validator<Prisma.UserCommentLikeConnectionArgs>()({
    include: includeCommentWithPostWithInsesData(''),
  });
export type LikeCommentWithPostWithInses =
  Prisma.UserCommentLikeConnectionGetPayload<
    typeof likeCommentWithPostWithInses
  >;
