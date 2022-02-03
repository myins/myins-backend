import { Post, UserInsConnection, Comment } from '.prisma/client';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CommentService } from 'src/comment/comment.service';
import { PostService } from 'src/post/post.service';
import { UserConnectionService } from 'src/user/user.connection.service';

@Injectable()
export class InteractionService {
  private readonly logger = new Logger(InteractionService.name);

  constructor(
    private readonly commentService: CommentService,
    private readonly userConnectionService: UserConnectionService,
    private readonly postService: PostService,
  ) {}

  async interact(userId: string, insId: string): Promise<UserInsConnection> {
    return this.userConnectionService.update({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }

  async interactPost(userId: string, postId: string) {
    const postWithIns = await this.postService.post({
      id: postId,
    });
    if (!postWithIns) {
      this.logger.error('Invalid post ID!');
      throw new BadRequestException('Invalid post ID!');
    }

    this.logger.log(
      `Incrementing interaction between user ${userId} and ins ${postWithIns.insId}`,
    );
    return this.userConnectionService.updateMany({
      where: {
        insId: postWithIns.insId,
        userId: userId,
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }

  async interactComment(userId: string, commentId: string) {
    const comment = await this.commentService.comment(
      {
        id: commentId,
      },
      {
        post: true,
      },
    );
    if (!comment) {
      this.logger.error('Invalid comment ID!');
      throw new BadRequestException('Invalid comment ID!');
    }

    const castedComment = <
      Comment & {
        post: Post;
      }
    >comment;
    this.logger.log(
      `Incrementing interaction between user ${userId} and inses ${castedComment.post.insId}`,
    );
    return this.userConnectionService.updateMany({
      where: {
        insId: castedComment.post.insId,
        userId: userId,
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }
}
