import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { Comment } from 'prisma/prisma-client';
import { CommentService } from './comment.service';

@Injectable()
export class CommentLikeService {
  private readonly logger = new Logger(CommentLikeService.name);

  constructor(
    private readonly commentService: CommentService,
    private readonly notifsService: NotificationService,
  ) {}

  async likeComment(userID: string, comment: Comment) {
    this.logger.log(
      `Updating comment ${comment.id}. Adding like connection with user ${userID}`,
    );
    const toRet = await this.commentService.updateComment({
      where: { id: comment.id },
      data: {
        likes: {
          create: {
            userId: userID,
          },
        },
      },
    });

    if (comment.authorId != userID) {
      this.logger.log(
        `Creating notification for liking comment ${comment.id} by user ${userID}`,
      );
      await this.notifsService.createNotification({
        source: 'LIKE_COMMENT',
        target: {
          connect: {
            id: comment.authorId,
          },
        },
        author: {
          connect: {
            id: userID,
          },
        },
        post: {
          connect: {
            id: comment.postId,
          },
        },
        comment: {
          connect: {
            id: comment.id,
          },
        },
      });
    }
    return toRet;
  }

  async unlikeComment(userID: string, comment: Comment) {
    this.logger.log(
      `Updating comment ${comment.id}. Deleting like connection with user ${userID}`,
    );
    return this.commentService.updateComment({
      where: { id: comment.id },
      data: {
        likes: {
          delete: {
            userId_commentId: {
              userId: userID,
              commentId: comment.id,
            },
          },
        },
      },
    });
  }
}
