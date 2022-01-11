import { NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CommentLikeController } from 'src/comment/comment.like.controller';
import { prismaMock } from 'tests/prisma-mock';
import { userMock } from 'tests/__mocks__/user';
import { getCommentTestingModule } from './test-module';

describe('[CommentLikeController] POST /', () => {
  let commentlikeController: CommentLikeController;

  beforeEach(async () => {
    const module: TestingModule = await getCommentTestingModule();
    commentlikeController = module.get<CommentLikeController>(
      CommentLikeController,
    );
  });

  test('[likeComment] return NotFoundException(Could not find this comment!)', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentlikeController.likeComment(userMock, 'commentID');
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find this comment!');
    }
  });
});
