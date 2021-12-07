import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CommentController } from 'src/comment/comment.controller';
import { prismaMock } from 'tests/prisma-mock';
import { commentMock } from 'tests/__mocks__/comment';
import { getCommentTestingModule } from './test-module';

describe('[CommentController] DELETE /:id', () => {
  let commentController: CommentController;

  beforeEach(async () => {
    const module: TestingModule = await getCommentTestingModule();
    commentController = module.get<CommentController>(CommentController);
  });

  test('[deleteComment] return NotFoundException(Could not find this comment!)', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentController.deleteComment('commentID', 'userID');
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find this comment!');
    }
  });

  test("[deleteComment] return BadRequestException(You're not allowed to delete this comment!)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(commentMock);

    expect.assertions(2);
    try {
      await commentController.deleteComment(commentMock.id, 'userID');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e).toHaveProperty(
        'message',
        "You're not allowed to delete this comment!",
      );
    }
  });

  test('[deleteComment] return deleted comment', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(commentMock);
    prismaMock.comment.delete.mockResolvedValue(commentMock);

    const result = await commentController.deleteComment(
      commentMock.id,
      commentMock.authorId,
    );

    expect(result.id).toBe(commentMock.id);
    expect(result.authorId).toBe(commentMock.authorId);
  });
});
