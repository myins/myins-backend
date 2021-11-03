import { Prisma, UserInsConnection, UserRole } from '.prisma/client';
import { ShallowUserSelect } from './shallow-user-select';

export const pendingUsersWhereQuery = (
  userId: string,
  userConnections: UserInsConnection[],
): Prisma.UserInsConnectionWhereInput => {
  return {
    role: UserRole.PENDING,
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
  };
};

const pendingUsersIncludeQuery = {
  ins: true,
  user: true,
};

export const pendingUsersIncludeQueryType: Prisma.UserInsConnectionInclude = {
  ins: true,
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
