import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PostContent, Story, User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { MediaService } from 'src/media/media.service';
import { CreatePostAPI, CreatePostFromLinksAPI } from './post-api.entity';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCreateController {
  private readonly logger = new Logger(PostCreateController.name);

  constructor(
    private readonly postService: PostService,
    private readonly insService: InsService,
    private readonly mediaService: MediaService,
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
      `Creating post by user ${user.id} in inses ${mappedINSIDs.map(
        (ins) => ins.id,
      )} with content: '${postData.content}'`,
    );
    const toRet = await this.postService.createPost({
      content: postData.content,
      author: {
        connect: {
          id: user.id,
        },
      },
      pending: false,
      totalMediaContent: postData.media.length,
      inses: {
        connect: mappedINSIDs,
      },
    });

    this.logger.log(
      `Getting story medias ${postData.media} and creating new post medias with same data`,
    );
    await Promise.all(
      medias.map((media) => {
        this.mediaService.create({
          content: media.content,
          post: {
            connect: {
              id: toRet.id,
            },
          },
          thumbnail: media.thumbnail,
          width: media.width,
          height: media.height,
          isVideo: media.isVideo,
        });
      }),
    );

    return toRet;
  }
}
