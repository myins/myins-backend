import { Injectable } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { Comment } from 'prisma/prisma-client';
import { CommentService } from './comment.service';

@Injectable()
export class CommentLikeService {
  constructor(
    private commentService: CommentService,
    private notifsService: NotificationService,
  ) {}

  async likeComment(userID: string, comment: Comment) {
    await this.commentService.updateComment({
      where: { id: comment.id },
      data: {
        likes: {
          connect: {
            id: userID,
          },
        },
      },
    });

    if (comment.authorId != userID) {
      this.notifsService.createNotification({
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
  }

  async unlikeComment(userID: string, comment: Comment) {
    this.commentService.updateComment({
      where: { id: comment.id },
      data: {
        likes: {
          disconnect: {
            id: userID,
          },
        },
      },
    });
  }
}
