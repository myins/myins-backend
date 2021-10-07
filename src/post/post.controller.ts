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
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PostService } from 'src/post/post.service';
import { PostMediaService } from 'src/post/post.media.service';
import { PatchCommentAPI } from 'src/comment/comment-api.entity';
import { PrismaUser } from 'src/decorators/user.decorator';
import { SharePostAPI } from './post-api.entity';
import { InsService } from 'src/ins/ins.service';
import { ChatService } from 'src/chat/chat.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly insService: InsService,
    private readonly chatService: ChatService,
    private readonly postMediaService: PostMediaService,
  ) {}

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPendingPosts(@PrismaUser('id') userID: string) {
    return this.postService.postsWithRelatedInfo({
      where: {
        authorId: userID,
        pending: true,
      },
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPostById(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
  ): Promise<PostModel | null> {
    return this.postService.injectedPost(id, userID);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async patchPost(
    @Param('id') postID: string,
    @Body() postData: PatchCommentAPI,
    @PrismaUser('id') userID: string,
  ) {
    const { content } = postData;
    if (content == null || content == undefined) {
      throw new BadRequestException('Content must be empty, not missing!');
    }

    const post = await this.postService.post({
      id: postID,
    });
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
        id: postID,
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
  async deletePost(
    @Param('id') postID: string,
    @PrismaUser('id') userID: string,
  ) {
    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      throw new UnauthorizedException(
        "You're not allowed to delete this post!",
      );
    }
    return this.postService.deletePost({ id: postID });
  }

  @Delete('/media/:id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async deletePostMedia(
    @Param('id') postMediaID: string,
    @PrismaUser('id') userID: string,
  ) {
    const postMedia = await this.postMediaService.getPostMediaById({
      id: postMediaID,
    });
    if (!postMedia) {
      throw new NotFoundException('Could not find this post media!');
    }
    const post = await this.postService.post({
      id: postMedia.postId,
    });
    if (!post) {
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      throw new UnauthorizedException(
        "You're not allowed to delete this post media!",
      );
    }
    await this.postMediaService.deletePostMedia({ id: postMediaID });

    const remainingMedia = await this.postMediaService.getMedias({
      where: {
        postId: post.id,
      },
    });
    if (!remainingMedia.length) {
      await this.postService.deletePost({ id: post.id });
    }

    return {
      message: 'Post media deleted!',
    };
  }

  @Patch(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async sharePost(
    @Param('id') postID: string,
    @PrismaUser('id') userID: string,
    @Body() shareData: SharePostAPI,
  ) {
    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      throw new UnauthorizedException("You're not allowed to share this post!");
    }

    const { ins } = shareData;
    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: userID,
          },
        },
      })
    ).map((each) => each.id);
    for (const each of ins) {
      if (!inses.includes(each)) {
        throw new UnauthorizedException(
          "You're not allowed to post to one of that INS!",
        );
      }
    }

    await this.postService.updatePost({
      where: {
        id: postID,
      },
      data: {
        inses: {
          connect: ins.map((insId) => ({ id: insId })),
        },
      },
    });
    await this.chatService.sendMessageWhenPost(ins, userID, post.content);

    return {
      message: 'Post shared!',
    };
  }
}
