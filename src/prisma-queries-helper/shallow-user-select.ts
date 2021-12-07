import { Prisma } from '.prisma/client';

export const ShallowUserSelect: Prisma.UserSelect = {
  firstName: true,
  lastName: true,
  profilePicture: true,
  id: true,
  isDeleted: true,
};

const shallowUserSelectWithRoleData = (insID: string) => {
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

export const ShallowUserSelectWithRoleInclude = (
  insID: string,
): Prisma.UserSelect => {
  return shallowUserSelectWithRoleData(insID);
};

const shallowUserSelectWithRole = Prisma.validator<Prisma.UserArgs>()({
  select: shallowUserSelectWithRoleData(''),
});
export type ShallowUserSelectWithRole = Prisma.UserGetPayload<
  typeof shallowUserSelectWithRole
>;
