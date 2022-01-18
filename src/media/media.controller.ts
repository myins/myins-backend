import {
  INS,
  Post as PostModel,
  PostContent,
  Story,
  StoryInsConnection,
  User,
  UserStoryMediaViewConnection,
} from '.prisma/client';
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
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { PostService } from 'src/post/post.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { StoryService } from 'src/story/story.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { omit } from 'src/util/omit';
import {
  AttachMediaAPI,
  DeleteStoryMediasAPI,
  SetHighlightAPI,
} from './media-api.entity';
import { MediaConnectionsService } from './media.connections.service';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly postService: PostService,
    private readonly storyService: StoryService,
    private readonly insService: InsService,
    private readonly mediaConnectionsService: MediaConnectionsService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async getMediaContent(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Query('insID') insID: string,
  ) {
    if (!insID) {
      this.logger.error('Invalid insID!');
      throw new BadRequestException('Invalid insID!');
    }

    this.logger.log(`Getting details for media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        views: {
          where: {
            id: userID,
            insId: insID,
          },
          select: {
            id: true,
          },
        },
        likes: {
          where: {
            id: userID,
            insId: insID,
          },
          select: {
            id: true,
          },
        },
        story: {
          include: {
            author: {
              select: ShallowUserSelect,
            },
            inses: {
              where: {
                id: insID,
              },
              select: {
                ins: {
                  select: ShallowINSSelect,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
              take: 1,
            },
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
        story: Story & {
          author: User;
          inses: (StoryInsConnection & {
            ins: INS;
          })[];
        };
      }
    >media;
    if (!castedMedia.story.inses.length) {
      this.logger.error('INS not found!');
      throw new NotFoundException('INS not found!');
    }

    const views = await this.mediaConnectionsService.countViews({
      where: {
        storyMediaId: castedMedia.id,
        insId: insID,
      },
    });
    const likes = await this.mediaConnectionsService.countLikes({
      where: {
        storyMediaId: castedMedia.id,
        insId: insID,
      },
    });
    const lastViews = await this.mediaConnectionsService.getViews({
      where: {
        storyMediaId: media.id,
        insId: insID,
      },
      include: {
        user: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
    });

    const castedLastViews = <
      (UserStoryMediaViewConnection & {
        user: User;
      })[]
    >lastViews;
    const mediaContent = {
      media: {
        ...omit(castedMedia, 'story'),
        _count: {
          views: views,
          likes: likes,
        },
      },
      author: castedMedia.story.author,
      ins: castedMedia.story.inses[0].ins,
      lastViews: castedLastViews.map((view) => view.user),
    };
    return mediaContent;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('medias')
  @UseInterceptors(photoOrVideoInterceptor)
  async attachMedia(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @PrismaUser('id') userID: string,
    @Body() body: AttachMediaAPI,
  ) {
    const isStoryEntity = body.isStoryEntity === 'true';
    const isHighlight = body.isHighlight === 'true';
    this.logger.log(
      `Attach media to ${isStoryEntity ? 'story' : 'post'} ${
        body.entityID
      } by user ${userID}`,
    );
    const firstFiles = files.file;
    const thumbnailFiles = files.thumbnail;
    if (!firstFiles) {
      this.logger.error('No file!');
      throw new BadRequestException('No file!');
    }
    const file = firstFiles[0];
    const isVideoPost = isVideo(file.originalname);
    if (!file.buffer) {
      this.logger.error('No buffer!');
      throw new BadRequestException('No buffer!');
    }
    if (
      isVideoPost &&
      (!thumbnailFiles || !thumbnailFiles.length || !thumbnailFiles[0].buffer)
    ) {
      this.logger.error('No thumbnail!');
      throw new BadRequestException('No thumbnail!');
    }

    const width = parseInt(body.width);
    const height = parseInt(body.height);
    if (!width || !height) {
      this.logger.error('Invalid width / height!');
      throw new BadRequestException('Invalid width / height!');
    }

    try {
      return this.mediaService.attachMedia(
        file,
        thumbnailFiles ? thumbnailFiles[0] : undefined,
        body.entityID,
        isStoryEntity,
        isHighlight,
        userID,
        {
          width,
          height,
          isVideo: isVideoPost,
          setCover: false,
        },
      );
    } catch (err) {
      this.logger.error('Error attaching media to post!');
      this.logger.error(err);
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
        throw new BadRequestException(`Error creating post! ${err}`);
      }
    }
  }

  @Patch(':id/set-highlight')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async setHighlight(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
    @Body() data: SetHighlightAPI,
  ) {
    this.logger.log(
      `Set highlight for story media ${mediaID} by user ${userID}`,
    );
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media || !media.storyId) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }
    const story = await this.storyService.story({
      id: media.storyId,
    });
    if (!story?.authorId || story.authorId !== userID) {
      this.logger.error('Not your story!');
      throw new NotFoundException('Not your story!');
    }

    this.logger.log(
      `Updating story media ${media.id}. Set highlight to ${data.isHighlight}`,
    );
    return this.mediaService.updateMedia({
      where: { id: media.id },
      data: {
        isHighlight: data.isHighlight,
      },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async deleteMedia(
    @Param('id') mediaID: string,
    @PrismaUser('id') userID: string,
  ) {
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media || (!media.postId && !media.storyId)) {
      this.logger.error(`Could not find media ${mediaID}!`);
      throw new NotFoundException('Could not find this media!');
    }

    let entityPossibleNull: PostModel | Story | null = null;
    if (media.storyId) {
      entityPossibleNull = await this.storyService.story({
        id: media.storyId,
      });
    } else if (media.postId) {
      entityPossibleNull = await this.postService.post({
        id: media.postId,
      });
    }
    const entity = entityPossibleNull;
    if (!entity) {
      this.logger.error(
        `Could not find ${media.storyId ? 'story' : 'post'} ${
          media.storyId ?? media.postId
        }!`,
      );
      throw new NotFoundException(
        `Could not find ${media.storyId ? 'story' : 'post'}!`,
      );
    }
    if (userID && entity.authorId && entity.authorId !== userID) {
      this.logger.error(`That's not your ${media.storyId ? 'story' : 'post'}!`);
      throw new BadRequestException(
        `That's not your ${media.storyId ? 'story' : 'post'}!`,
      );
    }

    this.logger.log(
      `Deleting media ${mediaID} from ${media.storyId ? 'story' : 'post'} ${
        entity.id
      } by user ${userID}`,
    );
    await this.mediaService.deleteMedia({ id: mediaID });

    const remainingMedia = await this.mediaService.getMedias({
      where: {
        postId: media.postId ? entity.id : undefined,
        storyId: media.storyId ? entity.id : undefined,
      },
    });
    if (!remainingMedia.length) {
      this.logger.log(
        `No media remaining for ${media.storyId ? 'story' : 'post'} ${
          entity.id
        }. Deleting ${media.storyId ? 'story' : 'post'} by user ${userID}`,
      );
      if (media.postId) {
        await this.postService.deletePost({ id: entity.id });
      } else {
        await this.storyService.deleteStory({ id: entity.id });
      }
    }

    this.logger.log('Media deleted');
    return {
      message: 'Media deleted!',
    };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async deleteStoryMedias(
    @PrismaUser('id') userID: string,
    @Body() data: DeleteStoryMediasAPI,
  ) {
    const storyMediaIDs = data.storyIDs;
    const medias = await this.mediaService.getMedias({
      where: {
        id: {
          in: storyMediaIDs,
        },
      },
      include: {
        story: true,
      },
    });
    if (!medias.length) {
      this.logger.error(`Could not find any media!`);
      throw new NotFoundException('Could not find any media!');
    }

    const storyIDs: string[] = [];
    medias.forEach((media) => {
      const story = (<
        PostContent & {
          story: Story;
        }
      >media).story;
      if (!story) {
        this.logger.error(`Could not find story for media ${media.id}!`);
        throw new NotFoundException(`Could not find story!`);
      }
      if (userID && story.authorId && story.authorId !== userID) {
        this.logger.error(`That's not your story!`);
        throw new BadRequestException(`That's not your story!`);
      }
      storyIDs.push(story.id);
    });

    this.logger.log(`Deleting story medias ${storyMediaIDs} by user ${userID}`);
    await this.mediaService.deleteMany({
      where: {
        id: {
          in: storyMediaIDs,
        },
      },
    });

    await Promise.all(
      storyIDs.map(async (storyID) => {
        const remainingMedia = await this.mediaService.getMedias({
          where: {
            storyId: storyID,
          },
        });
        if (!remainingMedia.length) {
          this.logger.log(
            `No media remaining for story ${storyID}. Deleting story`,
          );
          await this.storyService.deleteStory({ id: storyID });
        }
      }),
    );

    this.logger.log('Story medias deleted');
    return {
      message: 'Story medias deleted!',
    };
  }

  @Delete(':id/ins/:insID')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async deleteStoryMediaFromINS(
    @PrismaUser('id') userID: string,
    @Param('id') id: string,
    @Param('insID') insID: string,
  ) {
    const media = await this.mediaService.getMediaById({ id });
    if (!media || !media.storyId) {
      this.logger.error(`Could not find media!`);
      throw new NotFoundException('Could not find media!');
    }

    const story = await this.storyService.story(
      {
        id: media.storyId,
      },
      {
        inses: {
          where: {
            id: insID,
          },
        },
      },
    );
    const castedStory = <
      Story & {
        inses: StoryInsConnection[];
      }
    >story;
    if (!castedStory || !castedStory.inses.length) {
      this.logger.error(`Story not in that INS!`);
      throw new NotFoundException('Story not in that INS!');
    }
    if (castedStory.authorId !== userID) {
      this.logger.error(`Not your story!`);
      throw new NotFoundException('Not your story!');
    }

    if (!media.excludedInses.includes(insID)) {
      this.logger.log(`Update media ${id}. Add ins ${insID} to excluded inses`);
      await this.mediaService.updateMedia({
        where: {
          id: id,
        },
        data: {
          excludedInses: {
            push: insID,
          },
        },
      });

      this.logger.log(`Check if media ${id} should be deleted`);
      const newExcludedInses = [...media.excludedInses, insID];
      const inses = await this.insService.inses({
        where: {
          id: {
            not: {
              in: newExcludedInses,
            },
          },
          stories: {
            some: {
              story: {
                mediaContent: {
                  some: {
                    id,
                  },
                },
              },
            },
          },
        },
      });
      if (!inses.length) {
        await this.deleteMedia(id, userID);
      }
    }

    this.logger.log('Media deleted from INS');
    return {
      message: 'Media deleted from INS!',
    };
  }
}
