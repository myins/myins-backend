import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  NotificationSource,
  PostContent,
  Story,
  User,
  UserRole,
  Post as PostModel,
  Prisma,
} from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChatService } from 'src/chat/chat.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { MediaService } from 'src/media/media.service';
import { NotificationService } from 'src/notification/notification.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import {
  CreatePostAPI,
  CreatePostFromLinksAPI,
  SharePostAPI,
} from './post-api.entity';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
  private readonly logger = new Logger(PostCreateController.name);

  constructor(
    private readonly postService: PostService,
    private readonly insService: InsService,
    private readonly mediaService: MediaService,
    private readonly userConnectionService: UserConnectionService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async createPost(@Body() postData: CreatePostAPI, @PrismaUser() user: User) {
    if (!user.phoneNumberVerified) {
      this.logger.error(
        `Please verify phone ${user.phoneNumber} before creating posts!`,
      );
      throw new BadRequestException(
        'Please verify your phone before creating posts!',
      );
    }

    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: user.id,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      })
    ).map((each) => each.id);

    for (const each of postData.ins) {
      if (!inses.includes(each)) {
        this.logger.error("You're not allowed to post to that INS!");
        throw new BadRequestException(
          "You're not allowed to post to that INS!",
        );
      }
    }

    this.logger.log(
      `Creating post by user ${user.id} for every ins ${postData.ins} with content: '${postData.content}'`,
    );
    return Promise.all(
      postData.ins.map((insID) => {
        return this.postService.createPost({
          content: postData.content,
          author: {
            connect: {
              id: user.id,
            },
          },
          pending: true,
          totalMediaContent: postData.totalMediaContent,
          ins: {
            connect: {
              id: insID,
            },
          },
        });
      }),
    );
  }

  @Post('/links')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async createPostFromLinks(
    @Body() postData: CreatePostFromLinksAPI,
    @PrismaUser() user: User,
  ) {
    if (!user.phoneNumberVerified) {
      this.logger.error(
        `Please verify phone ${user.phoneNumber} before creating posts!`,
      );
      throw new BadRequestException(
        'Please verify your phone before creating posts!',
      );
    }

    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: user.id,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      })
    ).map((each) => each.id);

    for (const each of postData.ins) {
      if (!inses.includes(each)) {
        this.logger.error("You're not allowed to post to that INS!");
        throw new BadRequestException(
          "You're not allowed to post to that INS!",
        );
      }
    }

    const medias = await this.mediaService.getMedias({
      where: {
        id: {
          in: postData.media,
        },
      },
      include: {
        story: {
          select: {
            authorId: true,
          },
        },
      },
    });
    medias.forEach((media) => {
      const story = (<
        PostContent & {
          story: Story;
        }
      >media).story;
      if (!story || !story.authorId || story.authorId !== user.id) {
        this.logger.error(`Not your story!`);
        throw new NotFoundException(`Not your story!`);
      }
    });

    this.logger.log(
      `Creating post by user ${user.id} for every ins ${postData.ins} with content: '${postData.content}'`,
    );
    const toRet = await Promise.all(
      postData.ins.map((insID) => {
        return this.postService.createPost({
          content: postData.content,
          author: {
            connect: {
              id: user.id,
            },
          },
          pending: false,
          totalMediaContent: postData.media.length,
          ins: {
            connect: {
              id: insID,
            },
          },
        });
      }),
    );

    this.logger.log(
      `Getting story medias ${postData.media} and creating new post medias with same data`,
    );
    await Promise.all(
      medias.map(async (media) => {
        await this.mediaService.create({
          content: media.content,
          posts: {
            connect: toRet.map((post) => {
              return {
                id: post.id,
              };
            }),
          },
          thumbnail: media.thumbnail,
          width: media.width,
          height: media.height,
          isVideo: media.isVideo,
        });
      }),
    );

    await Promise.all(
      toRet.map(async (post) => {
        this.logger.log(`Creating notification for adding post ${post.id}`);

        const targetIDs = (
          await this.userConnectionService.getConnections({
            where: {
              insId: post.insId,
              userId: {
                not: user.id,
              },
              role: {
                not: UserRole.PENDING,
              },
            },
          })
        ).map((connection) => {
          return { id: connection.userId };
        });

        await this.notificationService.createNotification({
          source: NotificationSource.POST,
          targets: {
            connect: targetIDs,
          },
          author: {
            connect: {
              id: user.id,
            },
          },
          post: {
            connect: {
              id: post.id,
            },
          },
        });

        this.logger.log(
          `Send message by user ${user.id} in inses ${postData.ins} with new post ${post.id}`,
        );
        await this.chatService.sendMessageWhenPost(
          [post.insId],
          user.id,
          post.id,
        );
      }),
    );

    return toRet;
  }

  @Patch(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async sharePost(
    @Param('id') postID: string,
    @PrismaUser('id') userID: string,
    @Body() shareData: SharePostAPI,
  ) {
    const { ins } = shareData;
    this.logger.log(`Sharing post ${postID} in inses ${ins} by user ${userID}`);
    const post = await this.postService.post(
      {
        id: postID,
      },
      {
        mediaContent: true,
      },
    );
    if (!post) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      this.logger.error(`You're not allowed to share post ${postID}!`);
      throw new BadRequestException("You're not allowed to share this post!");
    }

    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: userID,
          },
        },
      })
    ).map((each) => each.id);
    for (const each of ins) {
      if (!inses.includes(each)) {
        this.logger.error("You're not allowed to post to one of that INS!");
        throw new BadRequestException(
          "You're not allowed to post to one of that INS!",
        );
      }
    }

    const castedPost = <
      PostModel & {
        mediaContent: PostContent[];
      }
    >post;
    this.logger.log(
      `Creating post by user ${userID} for every ins ${ins} with content: '${post.content}'`,
    );
    const newPosts = await Promise.all(
      ins.map((insID) => {
        return this.postService.createPost({
          content: post.content,
          author: {
            connect: {
              id: userID,
            },
          },
          pending: false,
          totalMediaContent: post.totalMediaContent,
          ins: {
            connect: {
              id: insID,
            },
          },
          mediaContent: {
            connect: castedPost.mediaContent.map((media) => {
              return {
                id: media.id,
              };
            }),
          },
        });
      }),
    );

    await Promise.all(
      newPosts.map(async (post) => {
        this.logger.log(`Creating notification for adding post ${post.id}`);

        const targetIDs = (
          await this.userConnectionService.getConnections({
            where: {
              insId: post.insId,
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

        const notifMetadata = {
          insesIDs: ins,
        } as Prisma.JsonObject;
        await this.notificationService.createNotification({
          source: NotificationSource.POST,
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
              id: post.id,
            },
          },
          metadata: notifMetadata,
        });

        this.logger.log(
          `Send message by user ${userID} in inses ${ins} with new post ${post.id}`,
        );
        await this.chatService.sendMessageWhenPost(
          [post.insId],
          userID,
          post.id,
        );
      }),
    );

    this.logger.log('Post shared');
    return {
      message: 'Post shared!',
    };
  }
}
