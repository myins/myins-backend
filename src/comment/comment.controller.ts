import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
    const comment = await this.commentService.comment({
      id: commentID,
    });
    if (comment == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (comment.authorId != userID) {
      throw new UnauthorizedException(
        "You're not allowed to delete this comment!",
      );
    }
    return await this.commentService.deleteComment(commentID);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async createComment(
    @Body() postData: CreateCommentAPI,
    @PrismaUser() user: User,
  ) {
    const { content, postID } = postData;

    if (!user.phoneNumberVerified) {
      throw new BadRequestException(
        'Please verify your phone before leaving comments!',
      );
    }

    const post = await this.postService.post({ id: postID }, false);
    if (!post || !post.authorId) {
      throw new BadRequestException('Could not find that post!');
    }

    const author = await this.userService.user({ id: post.authorId });

    if (!author) {
      throw new BadRequestException('Could not find that author!');
    }

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

    return toRet;
  }
}
