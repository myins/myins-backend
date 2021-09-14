import {
  BadRequestException,
  Controller,
  Get,
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
import { InsInteractionService } from 'src/ins/ins.interaction.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';
import { PostService } from './post.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostLikeController {
  constructor(
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly notificationsService: NotificationService,
    private readonly insInteractionService: InsInteractionService,
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
      includeRelatedInfo: false,
    });

    if (!postIfValid || postIfValid.length == 0) {
      throw new BadRequestException('Could not find post!');
    }

    return this.userService.users({
      where: {
        likedPosts: {
          some: {
            id: postID,
          },
        },
      },
      skip: skip,
      take: take,
      orderBy: {
        firstName: 'desc',
      },
    });
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async likePost(@PrismaUser() user: User, @Param('id') postID: string) {
    const post = await this.postService.post(
      {
        id: postID,
      },
      false,
    );
    if (post == null || !post.authorId) {
      throw new NotFoundException('Could not find this post!');
    }
    if (!user.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    const toRet = await this.postService.updatePost({
      where: { id: postID },
      data: {
        likes: {
          connect: {
            id: user.id,
          },
        },
      },
    });
    await this.insInteractionService.interact(user.id, toRet.id);

    if (post.authorId !== user.id) {
      this.notificationsService.createNotification({
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
    const post = await this.postService.post(
      {
        id: postID,
      },
      false,
    );
    if (post == null) {
      throw new NotFoundException('Could not find this post!');
    }
    if (!user.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    return this.postService.updatePost({
      where: { id: postID },
      data: {
        likes: {
          disconnect: {
            id: user.id,
          },
        },
      },
    });
  }
}
