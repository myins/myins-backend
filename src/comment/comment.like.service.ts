import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import {
  NotificationSource,
  Post,
  Prisma,
  UserCommentLikeConnection,
  UserRole,
} from 'prisma/prisma-client';
import { CommentService } from './comment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserConnectionService } from 'src/user/user.connection.service';

@Injectable()
export class CommentLikeService {
  private readonly logger = new Logger(CommentLikeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commentService: CommentService,
    private readonly notifsService: NotificationService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async commentLikes(
    params: Prisma.UserCommentLikeConnectionFindManyArgs,
  ): Promise<UserCommentLikeConnection[]> {
    return this.prisma.userCommentLikeConnection.findMany(params);
  }

  async deleteLike(where: Prisma.UserCommentLikeConnectionWhereUniqueInput) {
    return this.prisma.userCommentLikeConnection.delete({ where });
  }

  async deleteLikes(params: Prisma.UserCommentLikeConnectionDeleteManyArgs) {
    return this.prisma.userCommentLikeConnection.deleteMany(params);
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
      include: {
        post: true,
      },
    });

    this.logger.log(
      `Creating notification for liking comment ${commentID} by user ${userID}`,
    );

    const castedComment = <
      Comment & {
        post: Post;
      }
    >(<unknown>toRet);
    const targetIDs = (
      await this.userConnectionService.getConnections({
        where: {
          insId: castedComment.post.insId,
          userId: {
            not: userID,
          },
          role: {
            not: UserRole.PENDING,
          },
        },
      })
    ).map((connection) => {
      return { id: connection.userId };
    });

    await this.notifsService.createNotification({
      source: NotificationSource.LIKE_COMMENT,
      targets: {
        connect: targetIDs,
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
      ins: {
        connect: {
          id: castedComment.post.insId,
        },
      },
    });

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
