import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { UserService } from 'src/user/user.service';
import { CommentLikeService } from './comment.like.service';
import { CommentService } from './comment.service';

@Controller('comment')
export class CommentLikeController {
  constructor(
    private readonly userService: UserService,
    private readonly commentService: CommentService,
    private readonly commentLikeService: CommentLikeService,
  ) {}

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async likeComment(@UserID() userID: string, @Param('id') commentID: string) {
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    const user = await this.userService.user({ id: userID });
    if (!user?.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }

    await this.commentLikeService.likeComment(userID, comment);

    return {
      message: 'Liked comment successfully!',
    };
  }

  @Post(':id/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async unlikeComment(
    @UserID() userID: string,
    @Param('id') commentID: string,
  ) {
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    const user = await this.userService.user({ id: userID });
    if (!user?.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    this.commentLikeService.unlikeComment(userID, comment);

    return {
      message: 'Unliked comment successfully!',
    };
  }

  // @Get(':id/likes')
  // @UseGuards(JwtAuthGuard)
  // @ApiTags('posts')
  // async getLikesForComment(@Param('id') commentID: string, @Query('skip') skip: number, @Query('take') take: number) {
  //   return this.userService.users({
  //     where: {
  //       likedComments: {
  //         some: {
  //           id: commentID
  //         }
  //       }
  //     },
  //     skip: skip,
  //     take: take,
  //     orderBy: {
  //       firstName: 'desc'
  //     }
  //   })
  // }
}
