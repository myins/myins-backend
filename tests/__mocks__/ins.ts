import { INS } from '@prisma/client';

export const insesMock: INS[] = [
  {
    id: 'insID1',
    createdAt: new Date(),
    name: 'INS 1',
    cover: null,
    shareCode: '111111',
    invitedPhoneNumbers: [],
  },
  {
    id: 'insID2',
    createdAt: new Date(),
    name: 'INS 2',
    cover: null,
    shareCode: '222222',
    invitedPhoneNumbers: [],
  },
  {
    id: 'insID3',
    createdAt: new Date(),
    name: 'INS 3',
    cover: null,
    shareCode: '333333',
    invitedPhoneNumbers: [],
  },
];
