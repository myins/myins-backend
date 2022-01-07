import { Prisma } from '.prisma/client';

export const ShallowUserSelect: Prisma.UserSelect = {
  firstName: true,
  lastName: true,
  profilePicture: true,
  id: true,
  isDeleted: true,
};

export const ShallowUserSelectWithRoleInclude = (
  insID: string,
): Prisma.UserSelect => {
  return {
    firstName: true,
    lastName: true,
    profilePicture: true,
    id: true,
    isDeleted: true,
    inses: {
      where: {
        insId: insID,
      },
      select: {
        role: true,
      },
    },
  };
};
