import { UserInsConnection } from '.prisma/client';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CommentService } from 'src/comment/comment.service';
import { PostService } from 'src/post/post.service';
import {
  CommentWithPostWithInsesID,
  CommentWithPostWithInsesIDInclude,
} from 'src/prisma-queries-helper/comment-include-post-inses';
import {
  PostWithInsesId,
  PostWithInsesIdInclude,
} from 'src/prisma-queries-helper/post-include-inses-id';
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
    const postWithIns = await this.postService.post(
      {
        id: postId,
      },
      PostWithInsesIdInclude,
    );
    if (!postWithIns) {
      this.logger.error('Invalid post ID!');
      throw new BadRequestException('Invalid post ID!');
    }

    const insIDs = (<PostWithInsesId>postWithIns).inses.map((each) => each.id);
    this.logger.log(
      `Incrementing interaction between user ${userId} and inses ${insIDs}`,
    );
    return this.userConnectionService.updateMany({
      where: {
        insId: {
          in: insIDs,
        },
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
    const commentWithPost = await this.commentService.comment(
      {
        id: commentId,
      },
      CommentWithPostWithInsesIDInclude,
    );
    if (!commentWithPost) {
      this.logger.error('Invalid comment ID!');
      throw new BadRequestException('Invalid comment ID!');
    }

    const insIDs = (<CommentWithPostWithInsesID>commentWithPost).post.inses.map(
      (each) => each.id,
    );
    this.logger.log(
      `Incrementing interaction between user ${userId} and inses ${insIDs}`,
    );
    return this.userConnectionService.updateMany({
      where: {
        insId: {
          in: insIDs,
        },
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