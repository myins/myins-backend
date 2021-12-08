import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PostService } from 'src/post/post.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { AttachMediaAPI } from './media-api.entity';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly postService: PostService,
  ) {}

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('medias')
  @UseInterceptors(photoOrVideoInterceptor)
  async attachMedia(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @Param('id') postID2: string,
    @PrismaUser('id') userID: string,
    @Body() body: AttachMediaAPI,
  ) {
    this.logger.log(`Attach media to post ${postID2} by user ${userID}`);
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
        postID2,
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
    if (!media) {
      this.logger.error(`Could not find post media ${mediaID}!`);
      throw new NotFoundException('Could not find this post media!');
    }
    const post = await this.postService.post({
      id: media.postId,
    });
    if (!post) {
      this.logger.error(`Could not find post ${media.postId}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      this.logger.error(`You're not allowed to delete post media ${mediaID}!`);
      throw new BadRequestException(
        "You're not allowed to delete this post media!",
      );
    }

    this.logger.log(
      `Deleting post media ${mediaID} from post ${post.id} by user ${userID}`,
    );
    await this.mediaService.deleteMedia({ id: mediaID });

    const remainingMedia = await this.mediaService.getMedias({
      where: {
        postId: post.id,
      },
    });
    if (!remainingMedia.length) {
      this.logger.log(
        `No media remaining for post ${post.id}. Deleting post by user ${userID}`,
      );
      await this.postService.deletePost({ id: post.id });
    }

    this.logger.log('Post media deleted');
    return {
      message: 'Post media deleted!',
    };
  }
}
