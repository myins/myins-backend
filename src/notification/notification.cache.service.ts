import { Injectable } from '@nestjs/common';
import {
  Prisma,
  NotificationSource,
  User,
  Post,
  Story,
  INS,
} from '@prisma/client';
import { UserService } from 'src/user/user.service';
import { PostService } from 'src/post/post.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { CommentService } from 'src/comment/comment.service';
import { StoryService } from 'src/story/story.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
import { InsService } from 'src/ins/ins.service';

export interface NotificationCache {
  author?: User | null | undefined;
  post?: Post | null;
  comment?: Comment | null;
  story?: Story | null;
  inses?: INS[];
  ins?: INS | null;
}

@Injectable()
export class NotificationCacheService {
  constructor(
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
    private readonly storyService: StoryService,
    private readonly insService: InsService,
  ) {}

  async getDBCache(notif: Prisma.NotificationCreateInput) {
    switch (notif.source) {
      case NotificationSource.LIKE_POST:
        const authorLikePost = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const postLikePost = await this.postService.post(
          {
            id: notif.post?.connect?.id,
          },
          {
            author: {
              select: ShallowUserSelect,
            },
          },
        );
        return <NotificationCache>{
          author: authorLikePost,
          post: postLikePost,
        };
      case NotificationSource.LIKE_COMMENT:
        const authorLikeComment = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const commentLikeComment = await this.commentService.comment(
          {
            id: notif.comment?.connect?.id,
          },
          {
            author: {
              select: ShallowUserSelect,
            },
          },
        );
        return <NotificationCache>{
          author: authorLikeComment,
          comment: commentLikeComment,
        };
      case NotificationSource.LIKE_STORY:
        const authorLikeStory = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const storyLikeStory = await this.storyService.story(
          {
            id: notif.story?.connect?.id,
          },
          {
            author: {
              select: ShallowUserSelect,
            },
          },
        );
        return <NotificationCache>{
          author: authorLikeStory,
          story: storyLikeStory,
        };
      case NotificationSource.COMMENT:
        const authorComment = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const postComment = await this.postService.post(
          {
            id: notif.post?.connect?.id,
          },
          {
            author: {
              select: ShallowUserSelect,
            },
          },
        );
        return <NotificationCache>{
          author: authorComment,
          post: postComment,
        };
      case NotificationSource.POST:
        const authorPost = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        let inses: INS[] = [];
        const metadataPost = notif.metadata as Prisma.JsonObject;
        if (metadataPost?.insesIDs) {
          inses = await this.insService.inses({
            where: {
              id: {
                in: <string[]>metadataPost.insesIDs,
              },
            },
            select: ShallowINSSelect,
          });
        }
        return <NotificationCache>{
          author: authorPost,
          inses: inses,
        };
      case NotificationSource.JOINED_INS:
        const authorInsJoined = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const insJoined = await this.insService.ins({
          id: notif.ins?.connect?.id,
        });
        return <NotificationCache>{
          author: authorInsJoined,
          ins: insJoined,
        };
      case NotificationSource.JOIN_INS_REJECTED:
        const insJoinRejected = await this.insService.ins({
          id: notif.ins?.connect?.id,
        });
        return <NotificationCache>{
          ins: insJoinRejected,
        };
      case NotificationSource.CHANGE_ADMIN:
        const authorChangeAdmin = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const insChangeAdmin = await this.insService.ins({
          id: notif.ins?.connect?.id,
        });
        return <NotificationCache>{
          author: authorChangeAdmin,
          ins: insChangeAdmin,
        };
      case NotificationSource.DELETED_INS:
        const authorDeletedIns = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        return <NotificationCache>{
          author: authorDeletedIns,
        };
      case NotificationSource.PENDING_INS:
        const insPendingIns = await this.insService.ins({
          id: notif.ins?.connect?.id,
        });
        return <NotificationCache>{
          ins: insPendingIns,
        };
      case NotificationSource.DELETED_POST_BY_ADMIN:
        const authorDeletedPostByAdmin = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        const insDeletedPostByAdmin = await this.insService.ins({
          id: notif.ins?.connect?.id,
        });
        return <NotificationCache>{
          author: authorDeletedPostByAdmin,
          ins: insDeletedPostByAdmin,
        };
      case NotificationSource.STORY:
        const authorStory = await this.userService.shallowUser({
          id: notif.author.connect?.id,
        });
        return <NotificationCache>{
          author: authorStory,
        };
    }
    return <NotificationCache>{};
  }
}
