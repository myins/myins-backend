import { Prisma } from '.prisma/client';
import { ShallowUserSelect } from './shallow-user-select';

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
