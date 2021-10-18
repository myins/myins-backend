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
export class InsInteractionService {
  private readonly logger = new Logger(InsInteractionService.name);

  constructor(
    private readonly commentService: CommentService,
    private readonly userConnectionService: UserConnectionService,
    private readonly postService: PostService,
  ) {}

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
