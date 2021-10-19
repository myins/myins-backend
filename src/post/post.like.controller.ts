import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InteractionService } from 'src/interaction/interaction.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { NotificationService } from 'src/notification/notification.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PostLikeService } from './post.like.service';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostLikeController {
  private readonly logger = new Logger(PostLikeController.name);

  constructor(
    private readonly postService: PostService,
    private readonly notificationsService: NotificationService,
    private readonly interactionService: InteractionService,
    private readonly postLikeService: PostLikeService,
  ) {}

  @Get(':id/likes')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getLikesForPost(
    @PrismaUser('id') userID: string,
    @Param('id') postID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    this.logger.log(
      `Getting post ${postID} with all inses where user ${userID} is a member`,
    );
    const postIfValid = await this.postService.posts({
      where: {
        id: postID,
        inses: {
          some: {
            members: {
              some: {
                userId: userID,
              },
            },
          },
        },
      },
    });

    if (!postIfValid || postIfValid.length == 0) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new BadRequestException('Could not find post!');
    }

    this.logger.log(`Getting all likes for post ${postID}`);
    return this.postLikeService.postLikes({
      where: {
        postId: postID,
      },
      skip: skip,
      take: take,
      include: {
        user: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        user: {
          firstName: 'desc',
        },
      },
    });
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async likePost(@PrismaUser() user: User, @Param('id') postID: string) {
    this.logger.log(`Like post ${postID} by user ${user.id}`);
    const post = await this.postService.post({
      id: postID,
    });
    if (post == null || !post.authorId) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (!user.phoneNumberVerified) {
      this.logger.error(
        `You must verify phone ${user.phoneNumber} before liking posts!`,
      );
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }

    this.logger.log(
      `Updating post ${postID}. Adding like connection with user ${user.id}`,
    );
    const toRet = await this.postService.updatePost({
      where: { id: postID },
      data: {
        likes: {
          create: {
            userId: user.id,
          },
        },
      },
    });

    this.logger.log(
      `Adding interaction for user ${user.id} when liking post ${postID}`,
    );
    await this.interactionService.interactPost(user.id, toRet.id);

    if (post.authorId !== user.id) {
      this.logger.log(
        `Creating notification for liking post ${postID} by user ${user.id}`,
      );
      await this.notificationsService.createNotification({
        source: 'LIKE_POST',
        target: {
          connect: {
            id: post.authorId,
          },
        },
        author: {
          connect: {
            id: user.id,
          },
        },
        post: {
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
  @ApiTags('posts')
  async unlikePost(@PrismaUser() user: User, @Param('id') postID: string) {
    this.logger.log(`Unlike post ${postID} by user ${user.id}`);
    const post = await this.postService.post({
      id: postID,
    });
    if (post == null) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (!user.phoneNumberVerified) {
      this.logger.error(
        `You must verify phone ${user.phoneNumber} before liking posts!`,
      );
      throw new UnauthorizedException(
        'You must verify your phone before unliking posts!',
      );
    }

    this.logger.log(
      `Updating post ${postID}. Deleting like connection with user ${user.id}`,
    );
    return this.postService.updatePost({
      where: { id: postID },
      data: {
        likes: {
          delete: {
            userId_postId: {
              userId: user.id,
              postId: postID,
            },
          },
        },
      },
    });
  }
}
