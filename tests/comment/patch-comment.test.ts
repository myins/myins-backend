import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from 'src/comment/comment.controller';
import { CommentService } from 'src/comment/comment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaMock } from 'tests/prisma-mock';
import { commentMock } from 'tests/__mocks__/comment';
import { UserModule } from 'src/user/user.module';
import { PostModule } from 'src/post/post.module';
import { NotificationModule } from 'src/notification/notification.module';
import { InteractionModule } from 'src/interaction/interaction.module';
import { FirebaseMessagingService } from '@aginix/nestjs-firebase-admin';

describe('[CommentController] PATCH /:id', () => {
  let commentController: CommentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule, PostModule, NotificationModule, InteractionModule],
      providers: [
        CommentController,
        CommentService,
        FirebaseMessagingService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    commentController = module.get<CommentController>(CommentController);
  });

  test('[patchComment] return NotFoundException(Could not find this comment!)', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(commentMock);

    const result = await commentController.patchComment(
      'commentID',
      {
        content: 'content',
      },
      'userID',
    );

    expect(result).toThrow(
      new NotFoundException('Could not find this comment!'),
    );
  });
});
