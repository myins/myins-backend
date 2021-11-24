import { NotificationSource, Prisma, UserRole } from '.prisma/client';

const whereQuery = (targetId: string): Prisma.NotificationWhereInput => {
  return {
    OR: [
      {
        targets: {
          some: {
            id: targetId,
          },
        },
      },
      {
        AND: [
          {
            source: NotificationSource.POST,
          },
          {
            post: {
              inses: {
                some: {
                  members: {
                    some: {
                      userId: targetId,
                      role: {
                        not: UserRole.PENDING,
                      },
                    },
                  },
                },
              },
            },
          },
          {
            post: {
              NOT: {
                authorId: targetId,
              },
            },
          },
        ],
      },
      {
        AND: [
          {
            source: NotificationSource.JOINED_INS,
          },
          {
            ins: {
              members: {
                some: {
                  userId: targetId,
                },
              },
            },
          },
        ],
      },
    ],
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
const notificationFeedWithourPost = Prisma.validator<Prisma.NotificationArgs>()(
  {
    include: includeQueryWithoutPost(''),
  },
);
export type NotificationFeed = Prisma.NotificationGetPayload<
  typeof notificationFeed
>;
export type notificationFeedWithourPost = Prisma.NotificationGetPayload<
  typeof notificationFeedWithourPost
>;
