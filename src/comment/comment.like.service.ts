import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import {
  NotificationSource,
  Prisma,
  UserCommentLikeConnection,
} from 'prisma/prisma-client';
import { CommentService } from './comment.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommentLikeService {
  private readonly logger = new Logger(CommentLikeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commentService: CommentService,
    private readonly notifsService: NotificationService,
  ) {}

  async commentLikes(
    params: Prisma.UserCommentLikeConnectionFindManyArgs,
  ): Promise<UserCommentLikeConnection[]> {
    return this.prisma.userCommentLikeConnection.findMany(params);
  }

  async deleteLike(where: Prisma.UserCommentLikeConnectionWhereUniqueInput) {
    return this.prisma.userCommentLikeConnection.delete({ where });
  }

  async likeComment(userID: string, commentID: string) {
    this.logger.log(
      `Updating comment ${commentID}. Adding like connection with user ${userID}`,
    );
    const toRet = await this.commentService.updateComment({
      where: { id: commentID },
      data: {
        likes: {
          create: {
            userId: userID,
          },
        },
      },
    });

    if (toRet.authorId !== userID) {
      this.logger.log(
        `Creating notification for liking comment ${commentID} by user ${userID}`,
      );
      await this.notifsService.createNotification({
        source: NotificationSource.LIKE_COMMENT,
        targets: {
          connect: {
            id: toRet.authorId,
          },
        },
        author: {
          connect: {
            id: userID,
          },
        },
        post: {
          connect: {
            id: toRet.postId,
          },
        },
        comment: {
          connect: {
            id: commentID,
          },
        },
      });
    }

    return toRet;
  }

  async unlikeComment(userID: string, commentID: string) {
    this.logger.log(
      `Updating comment ${commentID}. Deleting like connection with user ${userID}`,
    );
    return this.commentService.updateComment({
      where: { id: commentID },
      data: {
        likes: {
          delete: {
            userId_commentId: {
              userId: userID,
              commentId: commentID,
            },
          },
        },
      },
    });
  }
}
