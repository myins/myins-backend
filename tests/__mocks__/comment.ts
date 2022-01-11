import { Comment } from '.prisma/client';
import * as uuid from 'uuid';
import { insesMock } from './ins';

export const commentMock: Comment = {
  id: 'commentID',
  createdAt: new Date(),
  content: 'New single comment',
  edited: false,
  authorId: uuid.v4(),
  postId: uuid.v4(),
};

export const updatedCommentMock: Comment = {
  ...commentMock,
  content: 'Updated comment content',
};

export const commentWithPostWithInsesMock = {
  ...commentMock,
  post: {
    inses: insesMock,
  },
};
