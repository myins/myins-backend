import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CommentService } from 'src/comment/comment.service';
import {
  CommentWithPostWithInses,
  CommentWithPostWithInsesInclude,
} from 'src/prisma-queries-helper/comment-with-post-with-inses';

@Injectable()
export class InsCleanMediaService {
  private readonly logger = new Logger(InsCleanMediaService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly commentService: CommentService,
  ) {}

  async cleanMedia(userId: string, insId: string) {
    return this.prismaService.$transaction(async () => {
      this.logger.log(`Cleaning comments for user ${userId} in ins ${insId}`);
      await this.cleanComments(userId, insId);

      // const myPosts = await this.postService.posts({
      //   where: {
      //     authorId: userId,
      //     inses: {
      //       some: {
      //         id: insId,
      //       },
      //     },
      //   },
      // });
      // const deletePostIDs: string[] = [];
      // myPosts.map(async (post) => {
      //   await this.postService.updatePost({
      //     where: {
      //       id: post.id,
      //     },
      //     data: {
      //       inses: {
      //         disconnect: {
      //           id: insId,
      //         },
      //       },
      //     },
      //   });
      //   const inses = await this.inses({
      //     where: {
      //       posts: {
      //         some: {
      //           id: post.id,
      //         },
      //       },
      //     },
      //   });
      //   if (!inses.length) {
      //     deletePostIDs.push(post.id);
      //   }
      // });
      // if (deletePostIDs.length) {
      //   await this.postService.deleteManyPosts({
      //     where: {
      //       id: {
      //         in: deletePostIDs,
      //       },
      //     },
      //   });
      // }
    });
  }

  async cleanComments(userId: string, insId: string) {
    this.logger.log(
      `Getting all comments that belongs to user ${userId} and to all posts from ins ${insId}`,
    );
    const myComments = await this.commentService.comments({
      where: {
        authorId: userId,
        post: {
          inses: {
            some: {
              id: insId,
            },
          },
        },
      },
      include: CommentWithPostWithInsesInclude(userId),
    });

    this.logger.log('Checking if any comments should be remove');
    const deleteCommentIDs: string[] = [];
    myComments.map(async (comment) => {
      if ((<CommentWithPostWithInses>comment).post.inses.length === 1) {
        deleteCommentIDs.push(comment.id);
      }
    });

    if (deleteCommentIDs.length) {
      this.logger.log(`Removing comments ${deleteCommentIDs}`);
      await this.commentService.deleteManyComment({
        where: {
          id: {
            in: deleteCommentIDs,
          },
        },
      });
    }

    this.logger.log(`Successfully cleaned ${deleteCommentIDs.length} comments`);
  }
}
