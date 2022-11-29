import {
  BadRequestException,
  Body,
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
import { Throttle } from '@nestjs/throttler';
import {
  NotificationSource,
  PostContent,
  ReactionsType,
  Story,
  StoryInsConnection,
  User,
  UserRole,
  UserStoryMediaLikeConnection,
  UserStoryMediaViewConnection,
} from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotificationService } from 'src/notification/notification.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { UserConnectionService } from 'src/user/user.connection.service';
import { omit } from 'src/util/omit';
import { LikeStoryMediaAPI } from './media-api.entity';
import { MediaConnectionsService } from './media.connections.service';
import { MediaService } from './media.service';

@Controller('media')
export class MediaConnectionsController {
  private readonly logger = new Logger(MediaConnectionsController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly notificationService: NotificationService,
    private readonly mediaConnectionsService: MediaConnectionsService,
    private readonly userConnectionService: UserConnectionService,
    private readonly insService: InsService,
  ) {}

  @Get(':id/ins/:insId/views')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getViews(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(
      `Getting views for story media ${mediaID} in ins ${insId} by user ${userID}`,
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

    let myInsID: string | undefined = insId;
    const ins = await this.insService.ins({
      id: insId,
    });
    if (!ins) {
      myInsID = undefined;
    }

    const views = await this.mediaConnectionsService.getViews({
      where: {
        storyMediaId: mediaID,
        insId: myInsID,
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

  @Get(':id/ins/:insId/likes-count')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getLikesCount(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
  ) {
    this.logger.log(
      `Getting likes count for story media ${mediaID} in ins ${insId} by user ${userID}`,
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

    let myInsID: string | undefined = insId;
    const ins = await this.insService.ins({
      id: insId,
    });
    if (!ins) {
      myInsID = undefined;
    }

    const likes = await this.mediaConnectionsService.groupBy(
      ['reaction_type'],
      {
        insId: myInsID,
      },
    );

    return [
      ...likes,
      {
        reaction_type: 'ALL',
        _count: likes.reduce((a, b) => a + b._count, 0),
      },
    ];
  }

  @Get(':id/ins/:insId/likes')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getLikes(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
    @Query('reaction_type') reaction_type: ReactionsType,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(
      `Getting likes for story media ${mediaID} in ins ${insId} by user ${userID}`,
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

    let myInsID: string | undefined = insId;
    const ins = await this.insService.ins({
      id: insId,
    });
    if (!ins) {
      myInsID = undefined;
    }

    const likes = await this.mediaConnectionsService.getLikes({
      where: {
        storyMediaId: mediaID,
        insId: myInsID,
        user: {
          isDeleted: false,
        },
        reaction_type: reaction_type ?? undefined,
      },
      select: {
        user: {
          select: ShallowUserSelect,
        },
        reaction_type: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const castedLikes = <
      (UserStoryMediaLikeConnection & {
        user: User;
      })[]
    >(<unknown>likes);
    return castedLikes.map((like) => {
      return {
        ...like.user,
        reaction_type: like.reaction_type,
      };
    });
  }

  @Post(':id/ins/:insId/view')
  @UseGuards(JwtAuthGuard)
  @Throttle(120, 30) // limit, ttl. limit = cate request-uri pana crapa,  ttl = cat tine minte un request
  @ApiTags('media')
  async viewMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
  ) {
    this.logger.log(
      `View story media ${mediaID} in ins ${insId} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          include: {
            inses: {
              where: {
                id: insId,
                ins: {
                  members: {
                    some: {
                      userId: userID,
                    },
                  },
                },
              },
            },
          },
        },
        views: {
          where: {
            id: userID,
            insId: insId,
          },
        },
      },
    );
    const castedMedia = <
      PostContent & {
        story: Story & {
          inses: StoryInsConnection[];
        };
        views: UserStoryMediaLikeConnection[];
      }
    >media;
    if (!castedMedia) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }
    if (!castedMedia.story.inses.length) {
      this.logger.error(`You're not allowed to see a story from INS ${insId}!`);
      throw new BadRequestException(
        "You're not allowed to see a story from this INS!",
      );
    }

    if (castedMedia.views.length) {
      this.logger.log(`Return story because is already viewed`);
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
                insId: insId,
              },
            },
          },
        });
      } else {
        return omit(castedMedia, 'views', 'story');
      }
    }
  }

  @Post(':id/ins/:insId/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async likeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
    @Body() data: LikeStoryMediaAPI,
  ) {
    this.logger.log(
      `Like story media ${mediaID} in ins ${insId} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          include: {
            inses: {
              where: {
                id: insId,
                ins: {
                  members: {
                    some: {
                      userId: userID,
                    },
                  },
                },
              },
            },
          },
        },
        likes: {
          where: {
            id: userID,
            insId: insId,
          },
        },
      },
    );
    const castedMedia = <
      PostContent & {
        story: Story & {
          inses: StoryInsConnection[];
        };
        likes: UserStoryMediaLikeConnection[];
      }
    >media;
    if (!castedMedia) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }
    if (!castedMedia.story.inses.length) {
      this.logger.error(`You're not allowed to see a story from INS ${insId}!`);
      throw new BadRequestException(
        "You're not allowed to see a story from this INS!",
      );
    }

    let toRet;
    if (castedMedia.likes.length) {
      this.logger.log(
        `Updating story media ${mediaID}. Adding like connection with user ${userID}`,
      );
      toRet = await this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          likes: {
            update: {
              where: {
                id_storyMediaId_insId: {
                  id: userID,
                  insId: insId,
                  storyMediaId: mediaID,
                },
              },
              data: {
                reaction_type: data.reaction_type,
                createdAt: new Date(),
              },
            },
          },
        },
      });
    } else {
      this.logger.log(
        `Updating story media ${mediaID}. Adding like connection with user ${userID}`,
      );
      toRet = await this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          likes: {
            create: {
              id: userID,
              insId: insId,
              reaction_type: data.reaction_type,
            },
          },
        },
      });
    }

    if (toRet.storyId) {
      this.logger.log(
        `Creating notification for liking story media ${toRet.id} by user ${userID}`,
      );

      const targetIDs = (
        await this.userConnectionService.getConnections({
          where: {
            insId: insId,
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

      await this.notificationService.createNotification({
        source: NotificationSource.LIKE_STORY,
        targets: {
          connect: targetIDs,
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
        story: {
          connect: {
            id: toRet.storyId,
          },
        },
        ins: {
          connect: {
            id: insId,
          },
        },
      });
    }

    return toRet;
  }

  @Post(':id/ins/:insId/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async unlikeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Param('insId') insId: string,
  ) {
    this.logger.log(
      `Unlike story media ${mediaID} in ins ${insId} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          include: {
            inses: {
              where: {
                id: insId,
                ins: {
                  members: {
                    some: {
                      userId: userID,
                    },
                  },
                },
              },
            },
          },
        },
        likes: {
          where: {
            id: userID,
            insId: insId,
          },
        },
      },
    );
    const castedMedia = <
      PostContent & {
        story: Story & {
          inses: StoryInsConnection[];
        };
        likes: UserStoryMediaLikeConnection[];
      }
    >media;
    if (!castedMedia) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }
    if (!castedMedia.story.inses.length) {
      this.logger.error(`You're not allowed to see a story from INS ${insId}!`);
      throw new BadRequestException(
        "You're not allowed to see a story from this INS!",
      );
    }

    if (!castedMedia.likes.length) {
      return omit(castedMedia, 'likes', 'story');
    } else {
      this.logger.log(
        `Updating story media ${mediaID}. Deleting like connection with user ${userID}`,
      );
      return this.mediaService.updateMedia({
        where: { id: mediaID },
        data: {
          likes: {
            delete: {
              id_storyMediaId_insId: {
                id: userID,
                storyMediaId: mediaID,
                insId: insId,
              },
            },
          },
        },
      });
    }
  }
}
