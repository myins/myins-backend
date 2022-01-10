import { Prisma } from '.prisma/client';

const whereQuery = (targetId: string): Prisma.NotificationWhereInput => {
  return {
    targets: {
      some: {
        id: targetId,
      },
    },
  };
};

const includeQuery = (targetId: string) => {
  return {
    author: {
      select: {
        firstName: true,
        lastName: true,
        profilePicture: true,
        id: true,
      },
    },
    comment: {
      select: {
        content: true,
      },
    },
    ins: {
      select: {
        id: true,
        name: true,
        cover: true,
        shareCode: true,
        createdAt: true,
      },
    },
    post: {
      include: {
        inses: {
          where: {
            members: {
              some: {
                userId: targetId,
              },
            },
          },
          select: {
            id: true,
            name: true,
            cover: true,
            shareCode: true,
            createdAt: true,
          },
        },
        mediaContent: true,
      },
    },
  };
};

const includeQueryWithoutPost = (targetId: string) => {
  return {
    author: {
      select: {
        firstName: true,
        lastName: true,
        profilePicture: true,
        id: true,
      },
    },
    comment: {
      select: {
        content: true,
      },
    },
    ins: {
      select: {
        id: true,
        name: true,
        cover: true,
        shareCode: true,
        createdAt: true,
      },
    },
    post: {
      select: {
        inses: {
          where: {
            members: {
              some: {
                userId: targetId,
              },
            },
          },
          select: {
            id: true,
            name: true,
            cover: true,
            shareCode: true,
            createdAt: true,
          },
        },
      },
    },
  };
};

const includeQueryType = (targetId: string): Prisma.NotificationInclude => {
  return includeQuery(targetId);
};

export const notificationFeedCount = (
  targetId: string,
): Prisma.NotificationCountArgs => {
  return {
    where: whereQuery(targetId),
  };
};

export const notificationFeedQuery = (
  targetId: string,
  skip: number,
  take: number,
): Prisma.NotificationFindManyArgs => {
  return {
    where: whereQuery(targetId),
    include: includeQueryType(targetId),
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
  };
};

const notificationFeed = Prisma.validator<Prisma.NotificationArgs>()({
  include: includeQuery(''),
});
const notificationFeedWithoutPost = Prisma.validator<Prisma.NotificationArgs>()(
  {
    include: includeQueryWithoutPost(''),
  },
);
export type NotificationFeed = Prisma.NotificationGetPayload<
  typeof notificationFeed
>;
export type NotificationFeedWithoutPost = Prisma.NotificationGetPayload<
  typeof notificationFeedWithoutPost
>;
