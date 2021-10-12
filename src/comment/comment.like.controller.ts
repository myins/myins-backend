import {
  Controller,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { CommentLikeService } from './comment.like.service';
import { CommentService } from './comment.service';

@Controller('comment')
export class CommentLikeController {
  private readonly logger = new Logger(CommentLikeController.name);

  constructor(
    private readonly commentService: CommentService,
    private readonly commentLikeService: CommentLikeService,
  ) {}

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async likeComment(@PrismaUser() user: User, @Param('id') commentID: string) {
    this.logger.log(`Like comment ${commentID} by user ${user.id}`);
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (!user.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }

    return this.commentLikeService.likeComment(user.id, comment);
  }

  @Post(':id/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async unlikeComment(
    @PrismaUser() user: User,
    @Param('id') commentID: string,
  ) {
    this.logger.log(`Unlike comment ${commentID} by user ${user.id}`);
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (!user.phoneNumberVerified) {
      throw new UnauthorizedException(
        'You must verify your phone before liking posts!',
      );
    }
    return this.commentLikeService.unlikeComment(user.id, comment);
  }
}
