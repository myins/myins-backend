import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Param,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { AttachMediaAPI, CreatePostAPI } from './post-api.entity';
import { PostMediaService } from './post.media.service';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
  constructor(
    private readonly postService: PostService,
    private readonly postMediaService: PostMediaService,
    private readonly insService: InsService,
  ) {}
  private readonly logger = new Logger(PostCreateController.name);

  @Post('media/:id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  @UseInterceptors(photoOrVideoInterceptor)
  async attachMediaToPost(
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
      return this.postMediaService.attachMediaToPost(
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

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async createPost(@Body() postData: CreatePostAPI, @PrismaUser() user: User) {
    if (postData.content == null || postData.content == undefined) {
      this.logger.error('Content must be empty, not missing!');
      throw new BadRequestException('Content must be empty, not missing!');
    }
    if (postData.ins.length == 0) {
      this.logger.error('Inses missing!');
      throw new BadRequestException('Inses missing!');
    }
    if (!user.phoneNumberVerified) {
      this.logger.error('Please verify your phone before creating posts!');
      throw new BadRequestException(
        'Please verify your phone before creating posts!',
      );
    }

    const mappedINSIDs = postData.ins.map((each) => {
      return { id: each };
    });

    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: user.id,
          },
        },
      })
    ).map((each) => each.id);

    for (const each of mappedINSIDs) {
      if (!inses.includes(each.id)) {
        this.logger.error("You're not allowed to post to that INS!");
        throw new UnauthorizedException(
          "You're not allowed to post to that INS!",
        );
      }
    }

    this.logger.log(
      `Creating post by user ${user.id} in inses ${mappedINSIDs.map(
        (ins) => ins.id,
      )} with content: '${postData.content}'`,
    );
    return this.postService.createPost({
      content: postData.content,
      author: {
        connect: {
          id: user.id,
        },
      },
      pending: true,
      totalMediaContent: postData.totalMediaContent,
      inses: {
        connect: mappedINSIDs,
      },
    });
  }
}
