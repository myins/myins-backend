import { INS, Post } from '.prisma/client';
import { insesMock } from './ins';

export const postMock: Post & {
  inses: INS[];
} = {
  id: 'postID',
  createdAt: new Date(),
  edited: false,
  content: 'post content',
  authorId: 'userID',
  pending: false,
  totalMediaContent: 7,
  inses: insesMock,
};
