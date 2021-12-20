import { Post as PostModel, PostContent, Story } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PostService } from 'src/post/post.service';
import { StoryService } from 'src/story/story.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import {
  AttachMediaAPI,
  DeleteStoryMediasAPI,
  SetHighlightAPI,
} from './media-api.entity';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly postService: PostService,
    private readonly storyService: StoryService,
  ) {}

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
}
