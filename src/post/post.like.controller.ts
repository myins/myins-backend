import { Controller, NotFoundException, Param, Post, UnauthorizedException, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
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
  ) {}


  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async likePost(@UserID() userID: string, @Param('id') postID: string) {
    const post = await this.postService.post(
      {
        id: postID,
      },
      false,
    );
    if (post == null || !post.authorId) {
      throw new NotFoundException('Could not find this post!');
    }
    const user = await this.userService.user({ id: userID });
    if (!user?.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    const toRet = await this.postService.updatePost({
      where: { id: postID },
      data: {
        likes: {
          connect: {
            id: userID,
          },
        },
      },
    });

    if (post.authorId !== userID) {
      this.notificationsService.createNotification({
        source: 'LIKE_POST',
        target: {
          connect: {
            id: post.authorId,
          },
        },
        author: {
          connect: {
            id: userID,
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
  async unlikePost(@UserID() userID: string, @Param('id') postID: string) {
    const post = await this.postService.post(
      {
        id: postID,
      },
      false,
    );
    if (post == null) {
      throw new NotFoundException('Could not find this post!');
    }
    const user = await this.userService.user({ id: userID });
    if (!user?.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    return this.postService.updatePost({
      where: { id: postID },
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
