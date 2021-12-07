import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CommentController } from 'src/comment/comment.controller';
import { prismaMock } from 'tests/prisma-mock';
import { commentMock, updatedCommentMock } from 'tests/__mocks__/comment';
import { getCommentTestingModule } from './test-module';

describe('[CommentController] PATCH /:id', () => {
  let commentController: CommentController;

  beforeEach(async () => {
    const module: TestingModule = await getCommentTestingModule();
    commentController = module.get<CommentController>(CommentController);
  });

  test('[patchComment] return NotFoundException(Could not find this comment!)', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentController.patchComment(
        'commentID',
        {
          content: 'content',
        },
        'userID',
      );
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find this comment!');
    }
  });

  test("[patchComment] return BadRequestException(You're not allowed to edit this comment!)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(commentMock);

    expect.assertions(2);
    try {
      await commentController.patchComment(
        commentMock.id,
        {
          content: 'content',
        },
        'userID',
      );
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e).toHaveProperty(
        'message',
        "You're not allowed to edit this comment!",
      );
    }
  });

  test('[patchComment] return updated comment', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(commentMock);
    prismaMock.comment.update.mockResolvedValue(updatedCommentMock);

    const result = await commentController.patchComment(
      commentMock.id,
      {
        content: updatedCommentMock.content,
      },
      commentMock.authorId,
    );

    expect(result.id).toBe(updatedCommentMock.id);
    expect(result.authorId).toBe(updatedCommentMock.authorId);
    expect(result.content).toBe(updatedCommentMock.content);
  });
});
