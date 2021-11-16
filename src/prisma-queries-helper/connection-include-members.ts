import { Prisma, UserRole } from '.prisma/client';

const connectionIncludeMembersData = {
  ins: {
    include: {
      members: {
        where: {
          role: {
            not: UserRole.PENDING,
          },
        },
      },
    },
  },
};
export const ConnectionIncludeMembersInclude: Prisma.UserInsConnectionInclude =
  connectionIncludeMembersData;

const connectionIncludeMembers =
  Prisma.validator<Prisma.UserInsConnectionArgs>()({
    include: connectionIncludeMembersData,
  });
export type ConnectionIncludeMembers = Prisma.UserInsConnectionGetPayload<
  typeof connectionIncludeMembers
>;
