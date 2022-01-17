import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  NotificationSource,
  PostContent,
  Story,
  User,
  UserStoryMediaLikeConnection,
  UserStoryMediaViewConnection,
} from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { omit } from 'src/util/omit';
import { MediaConnectionsService } from './media.connections.service';
import { MediaService } from './media.service';

@Controller('media')
export class MediaConnectionsController {
  private readonly logger = new Logger(MediaConnectionsController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly notificationService: NotificationService,
    private readonly mediaConnectionsService: MediaConnectionsService,
  ) {}

  @Get(':id/views')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getViews(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(
      `Getting views for story media ${mediaID} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          select: {
            authorId: true,
          },
        },
      },
    );
    if (!media || !media.storyId) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    const castedMedia = <
      PostContent & {
        story: Story;
      }
    >media;
    if (!castedMedia.story?.authorId || castedMedia.story.authorId !== userID) {
      this.logger.error('Not your story!');
      throw new NotFoundException('Not your story!');
    }

    const views = await this.mediaConnectionsService.getViews({
      where: {
        storyMediaId: mediaID,
        user: {
          isDeleted: false,
        },
      },
      select: {
        user: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const castedViews = <
      (UserStoryMediaViewConnection & {
        user: User;
      })[]
    >views;
    return castedViews.map((view) => view.user);
  }

  @Get(':id/likes')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getLikes(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(
      `Getting likes for story media ${mediaID} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          select: {
            authorId: true,
          },
        },
      },
    );
    if (!media || !media.storyId) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    const castedMedia = <
      PostContent & {
        story: Story;
      }
    >media;
    if (!castedMedia.story?.authorId || castedMedia.story.authorId !== userID) {
      this.logger.error('Not your story!');
      throw new NotFoundException('Not your story!');
    }

    const likes = await this.mediaConnectionsService.getLikes({
      where: {
        storyMediaId: mediaID,
        user: {
          isDeleted: false,
        },
      },
      select: {
        user: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const castedLikes = <
      (UserStoryMediaViewConnection & {
        user: User;
      })[]
    >likes;
    return castedLikes.map((like) => like.user);
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async viewMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`View story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          select: {
            authorId: true,
          },
        },
        views: {
          where: {
            id: userID,
          },
        },
      },
    );
    const castedMedia = <
      PostContent & {
        story: Story;
        views: UserStoryMediaLikeConnection[];
      }
    >media;
    if (!castedMedia) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    if (castedMedia.views.length) {
      return omit(castedMedia, 'views', 'story');
    } else {
      if (castedMedia.story.authorId !== userID) {
        this.logger.log(
          `Updating story media ${mediaID}. Adding view connection with user ${userID}`,
        );
        return this.mediaService.updateMedia({
          where: { id: mediaID },
          data: {
            views: {
              create: {
                id: userID,
              },
            },
          },
        });
      } else {
        return omit(castedMedia, 'views', 'story');
      }
    }
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async likeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Like story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        likes: {
          where: {
            id: userID,
          },
        },
      },
    );
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    const castedMedia = <
      PostContent & {
        likes: UserStoryMediaLikeConnection[];
      }
    >media;
    if (castedMedia.likes.length) {
      return omit(castedMedia, 'likes');
    } else {
      this.logger.log(
        `Updating story media ${mediaID}. Adding like connection with user ${userID}`,
      );
      const toRet = await this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          likes: {
            create: {
              id: userID,
            },
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

      const story = (<
        PostContent & {
          story: Story;
        }
      >toRet).story;
      if (story.authorId !== userID) {
        this.logger.log(
          `Creating notification for liking story media ${toRet.id} by user ${userID}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.LIKE_STORY,
          targets: {
            connect: {
              id: story.authorId,
            },
          },
          author: {
            connect: {
              id: userID,
            },
          },
          storyMedia: {
            connect: {
              id: toRet.id,
            },
          },
        });
      }

      return toRet;
    }
  }

  @Post(':id/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async unlikeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Unlike story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        likes: {
          where: {
            id: userID,
          },
        },
      },
    );
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    const castedMedia = <
      PostContent & {
        likes: UserStoryMediaLikeConnection[];
      }
    >media;
    if (!castedMedia.likes.length) {
      return omit(castedMedia, 'likes');
    } else {
      this.logger.log(
        `Updating story media ${mediaID}. Deleting like connection with user ${userID}`,
      );
      return this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          likes: {
            delete: {
              id_storyMediaId: {
                id: userID,
                storyMediaId: mediaID,
              },
            },
          },
        },
      });
    }
  }
}
