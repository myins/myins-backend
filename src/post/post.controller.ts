import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  INS,
  Post,
  Post as PostModel,
  PostContent,
  UserInsConnection,
  UserRole,
} from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PostService } from 'src/post/post.service';
import { PatchCommentAPI } from 'src/comment/comment-api.entity';
import { PrismaUser } from 'src/decorators/user.decorator';
import { DeletePostsAPI } from './post-api.entity';
import {
  NotificationPushService,
  PushExtraNotification,
  PushNotificationSource,
} from 'src/notification/notification.push.service';
import { UserService } from 'src/user/user.service';
import { omit } from 'src/util/omit';
import { MediaService } from 'src/media/media.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostController {
  private readonly logger = new Logger(PostController.name);

  constructor(
    private readonly postService: PostService,
    private readonly notificationPushService: NotificationPushService,
    private readonly userService: UserService,
    private readonly mediaService: MediaService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPostById(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
  ): Promise<PostModel | null> {
    this.logger.log(`Get post by id ${id} by user ${userID}`);
    const post = await this.postService.injectedPost(id, userID);
    if (!post) {
      this.logger.error(`Could not find post ${id}!`);
      throw new NotFoundException('Could not find this post!');
    }

    return post;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async patchPost(
    @Param('id') postID: string,
    @Body() postData: PatchCommentAPI,
    @PrismaUser('id') userID: string,
  ) {
    const { content } = postData;
    if (!content) {
      this.logger.error('Content must be empty, not missing!');
      throw new BadRequestException('Content must be empty, not missing!');
    }

    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId != userID) {
      this.logger.error(`You're not allowed to edit post ${postID}!`);
      throw new BadRequestException("You're not allowed to edit this post!");
    }

    this.logger.log(
      `Updating post ${postID} by user ${userID}. Changing content: '${content}'`,
    );
    return this.postService.updatePost({
      where: {
        id: postID,
      },
      data: {
        content: content,
        edited: true,
      },
    });
  }

  @Patch(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async reportPost(
    @Param('id') postID: string,
    @PrismaUser('id') userID: string,
  ) {
    const post = await this.postService.post(
      {
        id: postID,
      },
      {
        ins: {
          include: {
            members: {
              where: {
                userId: userID,
              },
            },
          },
        },
      },
    );

    const castedPost = <
      Post & {
        ins: INS & {
          members: UserInsConnection[];
        };
      }
    >post;
    if (!castedPost || !castedPost.ins || !castedPost.ins.members.length) {
      this.logger.error(`You're not allowed to report post ${postID}!`);
      throw new BadRequestException("You're not allowed to report this post!");
    }

    if (castedPost.reportedByUsers.includes(userID)) {
      return omit(castedPost, 'ins');
    } else {
      const toRet = await this.postService.updatePost({
        where: {
          id: postID,
        },
        data: {
          reportedAt: new Date(),
          reportedByUsers: {
            push: userID,
          },
        },
      });

      this.logger.log(
        `Creating push notification for reporting post ${castedPost.id}`,
      );
      const insesAdmin = await this.userService.users({
        where: {
          inses: {
            some: {
              insId: castedPost.insId,
              role: UserRole.ADMIN,
            },
          },
        },
      });
      const dataPush: PushExtraNotification = {
        source: PushNotificationSource.REPORT_ADMIN,
        ins: castedPost.ins,
        post: omit(castedPost, 'ins'),
        targets: [insesAdmin[0].id],
        countUsers: toRet.reportedByUsers.length,
      };
      await this.notificationPushService.pushNotification(dataPush);

      return toRet;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async deletePost(
    @Param('id') postID: string,
    @PrismaUser('id') userID: string,
  ) {
    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      this.logger.error(`You're not allowed to delete post ${postID}!`);
      throw new BadRequestException("You're not allowed to delete this post!");
    }

    this.logger.log(`Deleting post ${postID} by user ${userID}`);
    const deletedPost = await this.postService.deletePost(
      { id: postID },
      {
        mediaContent: {
          include: {
            posts: true,
          },
        },
      },
    );

    this.logger.log(
      `Removing media from post ${postID} by user ${userID} if not has any other related post`,
    );
    const castedDeletedPost = <
      Post & {
        mediaContent: (PostContent & {
          posts: Post[];
        })[];
      }
    >deletedPost;
    const deletedMediasIDs: string[] = [];
    castedDeletedPost.mediaContent.map((media) => {
      if (media.posts.length === 1) {
        deletedMediasIDs.push(media.id);
      }
    });

    await this.mediaService.deleteMany({
      where: {
        id: {
          in: deletedMediasIDs,
        },
      },
    });

    return omit(castedDeletedPost, 'mediaContent');
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async deletePosts(
    @PrismaUser('id') userID: string,
    @Body() data: DeletePostsAPI,
  ) {
    const posts = await this.postService.posts({
      where: {
        id: {
          in: data.postIDs,
        },
      },
      include: {
        mediaContent: {
          include: {
            posts: true,
          },
        },
      },
    });
    posts.forEach((post) => {
      if (post.authorId !== userID) {
        this.logger.error(`You're not allowed to delete post ${post.id}!`);
        throw new BadRequestException(
          "You're not allowed to delete those posts!",
        );
      }
    });

    this.logger.log(`Deleting posts ${data.postIDs} by user ${userID}`);
    await this.postService.deleteManyPosts({
      where: {
        id: {
          in: data.postIDs,
        },
      },
    });

    this.logger.log(
      `Removing media from post ${data.postIDs} by user ${userID} if not has any other related post`,
    );
    const castedDeletedPosts = <
      (Post & {
        mediaContent: (PostContent & {
          posts: Post[];
        })[];
      })[]
    >posts;
    const deletedMediasIDs: string[] = [];
    castedDeletedPosts.map((post) => {
      post.mediaContent.map((media) => {
        if (media.posts.length === 1) {
          deletedMediasIDs.push(media.id);
        }
      });
    });

    await this.mediaService.deleteMany({
      where: {
        id: {
          in: deletedMediasIDs,
        },
      },
    });

    this.logger.log('Posts successfully deleted');
    return {
      message: 'Posts successfully deleted',
    };
  }
}
