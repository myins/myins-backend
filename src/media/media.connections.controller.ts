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
import { NotificationSource, PostContent, Story, User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { omit } from 'src/util/omit';
import { MediaService } from './media.service';

@Controller('media')
export class MediaConnectionsController {
  private readonly logger = new Logger(MediaConnectionsController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly notificationService: NotificationService,
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
        views: {
          select: ShallowUserSelect,
          skip,
          take,
        },
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
        views: User[];
      }
    >media;
    if (!castedMedia.story?.authorId || castedMedia.story.authorId !== userID) {
      this.logger.error('Not your story!');
      throw new NotFoundException('Not your story!');
    }

    return castedMedia.views;
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
        likes: {
          select: ShallowUserSelect,
          skip,
          take,
        },
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
        likes: User[];
      }
    >media;
    if (!castedMedia.story?.authorId || castedMedia.story.authorId !== userID) {
      this.logger.error('Not your story!');
      throw new NotFoundException('Not your story!');
    }

    return castedMedia.likes;
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
      },
    );
    const castedMedia = <
      PostContent & {
        story: Story;
      }
    >media;
    if (!castedMedia) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    if (castedMedia.story.authorId !== userID) {
      this.logger.log(
        `Updating story media ${mediaID}. Adding view connection with user ${userID}`,
      );
      return this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          views: {
            connect: {
              id: userID,
            },
          },
        },
      });
    }

    return omit(castedMedia, 'story');
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async likeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Like story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    this.logger.log(
      `Updating story media ${mediaID}. Adding like connection with user ${userID}`,
    );
    const toRet = await this.mediaService.updateMedia({
      where: { id: mediaID },
      data: {
        likes: {
          connect: {
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

  @Post(':id/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async unlikeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Unlike story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    this.logger.log(
      `Updating story media ${mediaID}. Deleting like connection with user ${userID}`,
    );
    return this.mediaService.updateMedia({
      where: { id: mediaID },
      data: {
        likes: {
          disconnect: {
            id: userID,
          },
        },
      },
    });
  }
}
