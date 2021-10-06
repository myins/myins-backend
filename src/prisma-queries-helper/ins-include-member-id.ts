import { Prisma } from '.prisma/client';

const insWithMembersIDData = {
  members: {
    select: {
      userId: true,
    },
  },
};
export const InsWithMembersIDInclude: Prisma.INSInclude = insWithMembersIDData;

const insWithMembersID = Prisma.validator<Prisma.INSArgs>()({
  include: insWithMembersIDData,
});
export type InsWithMembersID = Prisma.INSGetPayload<typeof insWithMembersID>;
