import { Post } from '.prisma/client';

export const postMock: Post = {
  id: 'postID',
  createdAt: new Date(),
  edited: false,
  content: 'post content',
  authorId: 'userID',
  pending: false,
  totalMediaContent: 7,
};
