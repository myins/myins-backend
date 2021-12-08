import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { AttachMediaAPI } from 'src/media/media-api.entity';
import { MediaController } from 'src/media/media.controller';
import { photoOrVideoInterceptor } from 'src/util/multer';
import { CreatePostAPI } from './post-api.entity';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
  private readonly logger = new Logger(PostCreateController.name);

  constructor(
    private readonly postService: PostService,
    private readonly mediaController: MediaController,
    private readonly insService: InsService,
  ) {}

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
    return this.mediaController.attachMedia(files, postID2, userID, body);
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
      this.logger.error(
        `Please verify phone ${user.phoneNumber} before creating posts!`,
      );
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
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      })
    ).map((each) => each.id);

    for (const each of mappedINSIDs) {
      if (!inses.includes(each.id)) {
        this.logger.error("You're not allowed to post to that INS!");
        throw new BadRequestException(
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
