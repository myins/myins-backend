import { Comment } from '.prisma/client';
import * as uuid from 'uuid';

export const commentMock: Comment = {
  id: uuid.v4(),
  createdAt: new Date(),
  content: 'New single comment',
  edited: false,
  authorId: uuid.v4(),
  postId: uuid.v4(),
};
