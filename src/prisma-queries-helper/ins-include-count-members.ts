import { Prisma } from '.prisma/client';

const insWithCountMembersData = {
  _count: {
    select: {
      members: true,
    },
  },
};
export const InsWithCountMembersInclude: Prisma.INSInclude =
  insWithCountMembersData;

const insWithCountMembers = Prisma.validator<Prisma.INSArgs>()({
  include: insWithCountMembersData,
});
export type InsWithCountMembers = Prisma.INSGetPayload<
  typeof insWithCountMembers
>;
