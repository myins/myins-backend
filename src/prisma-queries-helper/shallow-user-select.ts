import { Prisma } from '.prisma/client';

export const ShallowUserSelect: Prisma.UserSelect = {
  firstName: true,
  lastName: true,
  profilePicture: true,
  id: true,
};
