import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CommentService } from 'src/comment/comment.service';
import {
  CommentWithPostWithInses,
  IncludeCommentWithPostWithInsesInclude,
  IncludePostWithInsesInclude,
  LikeCommentWithPostWithInses,
  LikePostWithPostWithInses,
} from 'src/prisma-queries-helper/include-post-with-inses';
import { PostLikeService } from 'src/post/post.like.service';
import { CommentLikeService } from 'src/comment/comment.like.service';
import { PostService } from 'src/post/post.service';
import { InsService } from './ins.service';

@Injectable()
export class InsCleanMediaService {
  private readonly logger = new Logger(InsCleanMediaService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly commentService: CommentService,
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
    private readonly commentLikeService: CommentLikeService,
    private readonly insService: InsService,
  ) {}

  async cleanMedia(userId: string, insId: string) {
    return this.prismaService.$transaction(async () => {
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

      this.logger.log(
        `Cleaning the posts that the user ${userId} had in ins ${insId}`,
      );
      await this.cleanPosts(userId, insId);
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
      include: IncludePostWithInsesInclude(userId),
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
      await this.commentService.deleteManyComments({
        where: {
          id: {
            in: deleteCommentIDs,
          },
        },
      });
    }

    this.logger.log(`Successfully cleaned ${deleteCommentIDs.length} comments`);
  }

  async cleanLikePosts(userId: string, insId: string) {
    this.logger.log(
      `Getting all like of the posts that belongs to user ${userId} and to all posts from ins ${insId}`,
    );
    const myLikePosts = await this.postLikeService.postLikes({
      where: {
        userId,
        post: {
          inses: {
            some: {
              id: insId,
            },
          },
        },
      },
      include: IncludePostWithInsesInclude(userId),
    });

    this.logger.log('Checking if any like of post should be remove');
    const deleteLikePostsIDs: {
      userId: string;
      postId: string;
    }[] = [];
    myLikePosts.map(async (likePost) => {
      if ((<LikePostWithPostWithInses>likePost).post.inses.length === 1) {
        deleteLikePostsIDs.push({
          userId: likePost.userId,
          postId: likePost.postId,
        });
      }
    });

    if (deleteLikePostsIDs.length) {
      this.logger.log(`Removing like of posts ${deleteLikePostsIDs}`);
      await this.prismaService.$transaction(async () => {
        deleteLikePostsIDs.forEach(async (likePost) => {
          await this.postLikeService.deleteLike({
            userId_postId: {
              postId: likePost.postId,
              userId: likePost.userId,
            },
          });
        });
      });
    }

    this.logger.log(
      `Successfully cleaned ${deleteLikePostsIDs.length} like of posts`,
    );
  }

  async cleanLikeComments(userId: string, insId: string) {
    this.logger.log(
      `Getting all like of the comments that belongs to user ${userId} and to all posts from ins ${insId}`,
    );
    const myLikeComments = await this.commentLikeService.commentLikes({
      where: {
        userId,
        comment: {
          post: {
            inses: {
              some: {
                id: insId,
              },
            },
          },
        },
      },
      include: IncludeCommentWithPostWithInsesInclude(userId),
    });

    this.logger.log('Checking if any like of comment should be remove');
    const deleteLikeCommentsIDs: {
      userId: string;
      commentId: string;
    }[] = [];
    myLikeComments.map(async (likeComment) => {
      if (
        (<LikeCommentWithPostWithInses>likeComment).comment.post.inses
          .length === 1
      ) {
        deleteLikeCommentsIDs.push({
          userId: likeComment.userId,
          commentId: likeComment.commentId,
        });
      }
    });

    if (deleteLikeCommentsIDs.length) {
      this.logger.log(`Removing like of comments ${deleteLikeCommentsIDs}`);
      await this.prismaService.$transaction(async () => {
        deleteLikeCommentsIDs.forEach(async (likeComment) => {
          await this.commentLikeService.deleteLike({
            userId_commentId: {
              commentId: likeComment.commentId,
              userId: likeComment.userId,
            },
          });
        });
      });
    }

    this.logger.log(
      `Successfully cleaned ${deleteLikeCommentsIDs.length} likes of posts`,
    );
  }

  async cleanPosts(userId: string, insId: string) {
    this.logger.log(
      `Getting all posts that belongs to user ${userId} in ins ${insId}`,
    );
    const myPosts = await this.postService.posts({
      where: {
        authorId: userId,
        inses: {
          some: {
            id: insId,
          },
        },
      },
    });

    this.logger.log(
      'Removing inses from every post and checking if any post should be remove',
    );
    const deletePostIDs: string[] = [];
    myPosts.map(async (post) => {
      await this.postService.updatePost({
        where: {
          id: post.id,
        },
        data: {
          inses: {
            disconnect: {
              id: insId,
            },
          },
        },
      });
      const inses = await this.insService.inses({
        where: {
          posts: {
            some: {
              id: post.id,
            },
          },
        },
      });
      if (!inses.length) {
        deletePostIDs.push(post.id);
      }
    });

    this.logger.log(`Removing posts ${deletePostIDs}`);
    if (deletePostIDs.length) {
      await this.postService.deleteManyPosts({
        where: {
          id: {
            in: deletePostIDs,
          },
        },
      });
    }

    this.logger.log(
      `Successfully removed posts from ins ${insId} and cleaned ${deletePostIDs.length} posts`,
    );
  }
}