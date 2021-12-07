import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CommentController } from 'src/comment/comment.controller';
import { prismaMock } from 'tests/prisma-mock';
import {
  commentMock,
  commentWithPostWithInsesMock,
} from 'tests/__mocks__/comment';
import { postMock } from 'tests/__mocks__/post';
import {
  userMock,
  userMockPhoneNumberUnverified,
  userMockPhoneNumberVerified,
} from 'tests/__mocks__/user';
import { getCommentTestingModule } from './test-module';

describe('[CommentController] POST /', () => {
  let commentController: CommentController;

  beforeEach(async () => {
    const module: TestingModule = await getCommentTestingModule();
    commentController = module.get<CommentController>(CommentController);
  });

  test('[createComment] return BadRequestException(Please verify your phone before leaving comments!)', async () => {
    expect.assertions(2);
    try {
      await commentController.createComment(
        {
          content: 'content',
          postID: 'postID',
        },
        userMockPhoneNumberUnverified,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e).toHaveProperty(
        'message',
        'Please verify your phone before leaving comments!',
      );
    }
  });

  test('[createComment] return NotFoundException(Could not find that post!)', async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentController.createComment(
        {
          content: 'content',
          postID: 'postID',
        },
        userMockPhoneNumberVerified,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find that post!');
    }
  });

  test('[createComment] return NotFoundException(Could not find that author!)', async () => {
    prismaMock.post.findUnique.mockResolvedValue(postMock);
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentController.createComment(
        {
          content: 'content',
          postID: postMock.id,
        },
        userMockPhoneNumberVerified,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find that author!');
    }
  });

  test('[createComment] return BadRequestException(Invalid comment ID!)', async () => {
    prismaMock.post.findUnique.mockResolvedValue(postMock);
    prismaMock.user.findUnique.mockResolvedValue(userMock);
    prismaMock.comment.create.mockResolvedValue(commentMock);
    prismaMock.comment.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await commentController.createComment(
        {
          content: 'content',
          postID: postMock.id,
        },
        userMockPhoneNumberVerified,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e).toHaveProperty('message', 'Invalid comment ID!');
    }
  });

  test('[createComment] return BadRequestException(Could not find that author!)', async () => {
    prismaMock.post.findUnique.mockResolvedValue(postMock);
    prismaMock.user.findUnique.mockResolvedValue(userMock);
    prismaMock.comment.create.mockResolvedValue(commentMock);
    prismaMock.comment.findUnique.mockResolvedValue(
      commentWithPostWithInsesMock,
    );

    const result = await commentController.createComment(
      {
        content: 'content',
        postID: postMock.id,
      },
      userMockPhoneNumberVerified,
    );

    expect(result.id).toBe(commentMock.id);
  });
});
