import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CommentService } from 'src/comment/comment.service';
import { PostLikeService } from 'src/post/post.like.service';
import { CommentLikeService } from 'src/comment/comment.like.service';
import { PostService } from 'src/post/post.service';

@Injectable()
export class InsCleanMediaService {
  private readonly logger = new Logger(InsCleanMediaService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly commentService: CommentService,
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
    private readonly commentLikeService: CommentLikeService,
  ) {}

  async cleanMedia(userId: string, insId: string) {
    return this.prismaService.$transaction(async () => {
      this.logger.log(
        `Cleaning the posts that the user ${userId} had in ins ${insId}`,
      );
      await this.cleanPosts(userId, insId);

      this.logger.log(
        `Cleaning the comments from user ${userId} in ins ${insId}`,
      );
      await this.cleanComments(userId, insId);

      this.logger.log(
        `Cleaning the like of the posts that the user ${userId} gave in ins ${insId}`,
      );
      await this.cleanLikePosts(userId, insId);

      this.logger.log(
        `Cleaning the like of the comments that the user ${userId} gave in ins ${insId}`,
      );
      await this.cleanLikeComments(userId, insId);
    });
  }

  async cleanPosts(userId: string, insId: string) {
    this.logger.log(
      `Removing posts that belongs to user ${userId} from ins ${insId}`,
    );
    const myPosts = await this.postService.deleteManyPosts({
      where: {
        authorId: userId,
        insId: insId,
      },
    });

    this.logger.log(`Successfully cleaned ${myPosts.count} posts`);
  }

  async cleanComments(userId: string, insId: string) {
    this.logger.log(
      `Removing comments that belongs to user ${userId} and to any post from ins ${insId}`,
    );
    const myComments = await this.commentService.deleteManyComments({
      where: {
        authorId: userId,
        post: {
          insId: insId,
        },
      },
    });

    this.logger.log(`Successfully cleaned ${myComments.count} comments`);
  }

  async cleanLikePosts(userId: string, insId: string) {
    this.logger.log(
      `Removing likes of post that belongs to user ${userId} and to any post from ins ${insId}`,
    );
    const myLikesPost = await this.postLikeService.deleteLikes({
      where: {
        userId: userId,
        post: {
          insId: insId,
        },
      },
    });

    this.logger.log(`Successfully cleaned ${myLikesPost.count} like of posts`);
  }

  async cleanLikeComments(userId: string, insId: string) {
    this.logger.log(
      `Removing likes of comment that belongs to user ${userId} and to any post from ins ${insId}`,
    );
    const myLikesComment = await this.commentLikeService.deleteLikes({
      where: {
        userId: userId,
        comment: {
          post: {
            insId: insId,
          },
        },
      },
    });

    this.logger.log(
      `Successfully cleaned ${myLikesComment.count} likes of comments`,
    );
  }
}
