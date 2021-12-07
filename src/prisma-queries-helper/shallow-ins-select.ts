import { Prisma } from '.prisma/client';

export const ShallowINSSelect: Prisma.INSSelect = {
  id: true,
  name: true,
  cover: true,
  shareCode: true,
  createdAt: true,
};
