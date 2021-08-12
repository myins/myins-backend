import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Post as PostModel } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PostService } from 'src/post/post.service';
import { PatchCommentAPI } from 'src/comment/comment-api.entity';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostController {
  constructor(
    private readonly postService: PostService,
  ) { }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPendingPosts(@Param('id') id: string, @UserID() userID: string) {
    return this.postService.posts({
      skip: 0,
      take: 5,
      where: {
        authorId: userID,
        pending: true,
      }, includeUserInfo: false
    })
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPostById(@Param('id') id: string, @UserID() userID: string): Promise<PostModel | null> {
    return this.postService.injectedPost(id, userID)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async patchPost(
    @Param('id') commentID: string,
    @Body() postData: PatchCommentAPI,
    @UserID() userID: string,
  ) {
    const { content } = postData;
    if (content == null || content == undefined) {
      throw new BadRequestException("Content must be empty, not missing!")
    }

    const post = await this.postService.post(
      {
        id: commentID,
      },
      false,
    );
    if (post == null) {
      throw new NotFoundException('Could not find this comment!');
    }
    if (post.authorId != userID) {
      throw new UnauthorizedException(
        "You're not allowed to edit this comment!",
      );
    }
    return this.postService.updatePost({
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
  @ApiTags('posts')
  async deletePost(@Param('id') postID: string, @UserID() userID: string) {
    const comment = await this.postService.post(
      {
        id: postID,
      },
      false,
    );
    if (comment == null) {
      throw new NotFoundException('Could not find this post!');
    }
    if (comment.authorId != userID) {
      throw new UnauthorizedException(
        "You're not allowed to delete this post!",
      );
    }
    return this.postService.deletePost(postID);
  }
}
