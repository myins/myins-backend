import { Prisma, UserInsConnection, UserRole } from '.prisma/client';
import { ShallowINSSelect } from './shallow-ins-select';
import { ShallowUserSelect } from './shallow-user-select';

export const pendingUsersWhereQuery = (
  userId: string,
  userConnections: UserInsConnection[],
): Prisma.UserInsConnectionWhereInput => {
  return {
    role: UserRole.PENDING,
    OR: [
      {
        insId: {
          in: userConnections.map((connection) => connection.insId),
        },
        OR: [
          {
            deniedByUsers: {
              equals: null,
            },
          },
          {
            NOT: {
              deniedByUsers: {
                has: userId,
              },
            },
          },
        ],
        invitedBy: null,
      },
      {
        userId: userId,
        role: UserRole.PENDING,
        invitedBy: {
          not: null,
        },
      },
    ],
    user: {
      isDeleted: false,
    },
  };
};

const pendingUsersIncludeQuery = {
  ins: true,
  user: true,
};

export const pendingUsersIncludeQueryType: Prisma.UserInsConnectionInclude = {
  ins: {
    select: ShallowINSSelect,
  },
  user: {
    select: ShallowUserSelect,
  },
};

const pendingUsersInclude = Prisma.validator<Prisma.UserInsConnectionArgs>()({
  include: pendingUsersIncludeQuery,
});
export type PendingUsersInclude = Prisma.UserInsConnectionGetPayload<
  typeof pendingUsersInclude
>;
