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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { PostService } from 'src/post/post.service';
import { UserService } from 'src/user/user.service';
import { CreateCommentAPI, PatchCommentAPI } from './comment-api.entity';
import { CommentService } from './comment.service';

@Controller('comment')
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
    private readonly notificationService: NotificationService,
  ) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async patchComment(
    @Param('id') commentID: string,
    @Body() postData: PatchCommentAPI,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Updating comment ${commentID} by user ${userID}`);
    const { content } = postData;

    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (comment.authorId != userID) {
      throw new UnauthorizedException(
        "You're not allowed to edit this comment!",
      );
    }

    this.logger.log(`Updating content for comment ${commentID}: ${postData}`);
    return this.commentService.updateComment({
      where: {
        id: commentID,
      },
      data: {
        content: content,
        edited: true,
      },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async deleteComment(
    @Param('id') commentID: string,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Deleting comment ${commentID} by user ${userID}`);
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (!comment) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (comment.authorId !== userID) {
      throw new UnauthorizedException(
        "You're not allowed to delete this comment!",
      );
    }
    return this.commentService.deleteComment({ id: commentID });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async createComment(
    @Body() postData: CreateCommentAPI,
    @PrismaUser() user: User,
  ) {
    const { content, postID } = postData;
    this.logger.log(`Creating comment for post ${postID} by user ${user.id}`);

    if (!user.phoneNumberVerified) {
      throw new BadRequestException(
        'Please verify your phone before leaving comments!',
      );
    }

    const post = await this.postService.post({ id: postID });
    if (!post || !post.authorId) {
      throw new BadRequestException('Could not find that post!');
    }

    const author = await this.userService.user({ id: post.authorId });

    if (!author) {
      throw new BadRequestException('Could not find that author!');
    }

    this.logger.log(`Creating comment with content: ${content}`);
    const toCreate: Prisma.CommentCreateInput = {
      content: content,
      author: {
        connect: {
          id: user.id,
        },
      },
      post: {
        connect: {
          id: post.id,
        },
      },
    };
    const toRet = await this.commentService.createComment(toCreate);

    this.logger.log(`Creating notification for comment ${toRet.id}`);
    await this.notificationService.createNotification(
      {
        source: 'COMMENT',
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
        comment: {
          connect: {
            id: toRet.id,
          },
        },
        post: {
          connect: {
            id: post.id,
          },
        },
      },
      false,
    );

    this.logger.log('Successfully created comment');
    return toRet;
  }
}
