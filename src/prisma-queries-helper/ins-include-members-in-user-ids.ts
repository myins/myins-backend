import { Prisma } from '.prisma/client';

const insWithMembersInUserIDsData = (userIDs: string[]) => {
  return {
    members: {
      where: {
        userId: {
          in: userIDs,
        },
      },
    },
  };
};

export const InsWithMembersInUserIDsInclude = (
  userIDs: string[],
): Prisma.INSInclude => {
  return {
    members: {
      where: {
        userId: {
          in: userIDs,
        },
      },
    },
  };
};

const insWithMembersInUserIDs = Prisma.validator<Prisma.INSArgs>()({
  include: insWithMembersInUserIDsData([]),
});
export type InsWithMembersInUserIDs = Prisma.INSGetPayload<
  typeof insWithMembersInUserIDs
>;
