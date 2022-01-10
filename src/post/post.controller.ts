import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationSource, Post as PostModel } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PostService } from 'src/post/post.service';
import { PatchCommentAPI } from 'src/comment/comment-api.entity';
import { PrismaUser } from 'src/decorators/user.decorator';
import { DeletePostsAPI, SharePostAPI } from './post-api.entity';
import { InsService } from 'src/ins/ins.service';
import { ChatService } from 'src/chat/chat.service';
import { NotificationService } from 'src/notification/notification.service';
import { UserConnectionService } from 'src/user/user.connection.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostController {
  private readonly logger = new Logger(PostController.name);

  constructor(
    private readonly postService: PostService,
    private readonly insService: InsService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPendingPosts(@PrismaUser('id') userID: string) {
    this.logger.log(`Get pending posts by user ${userID}`);
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
    this.logger.log(`Get post by id ${id} by user ${userID}`);
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
    if (!content) {
      this.logger.error('Content must be empty, not missing!');
      throw new BadRequestException('Content must be empty, not missing!');
    }

    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId != userID) {
      this.logger.error(`You're not allowed to edit post ${postID}!`);
      throw new BadRequestException("You're not allowed to edit this post!");
    }

    this.logger.log(
      `Updating post ${postID} by user ${userID}. Changing content: '${content}'`,
    );
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
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      this.logger.error(`You're not allowed to delete post ${postID}!`);
      throw new BadRequestException("You're not allowed to delete this post!");
    }

    this.logger.log(`Deleting post ${postID} by user ${userID}`);
    return this.postService.deletePost({ id: postID });
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async deletePosts(
    @PrismaUser('id') userID: string,
    @Body() data: DeletePostsAPI,
  ) {
    const posts = await this.postService.posts({
      where: {
        id: {
          in: data.postIDs,
        },
      },
    });
    posts.forEach((post) => {
      if (post.authorId !== userID) {
        this.logger.error(`You're not allowed to delete post ${post.id}!`);
        throw new BadRequestException(
          "You're not allowed to delete those posts!",
        );
      }
    });

    this.logger.log(`Deleting posts ${data.postIDs} by user ${userID}`);
    await this.postService.deleteManyPosts({
      where: {
        id: {
          in: data.postIDs,
        },
      },
    });

    this.logger.log('Posts successfully deleted');
    return {
      message: 'Posts successfully deleted',
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
    const { ins } = shareData;
    this.logger.log(`Sharing post ${postID} in inses ${ins} by user ${userID}`);
    const post = await this.postService.post({
      id: postID,
    });
    if (!post) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find this post!');
    }
    if (post.authorId !== userID) {
      this.logger.error(`You're not allowed to share post ${postID}!`);
      throw new BadRequestException("You're not allowed to share this post!");
    }

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
        this.logger.error("You're not allowed to post to one of that INS!");
        throw new BadRequestException(
          "You're not allowed to post to one of that INS!",
        );
      }
    }

    this.logger.log(
      `Updating post ${postID}. Adding connections with inses ${ins}`,
    );
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

    this.logger.log(`Creating notification for adding post ${postID}`);
    const targetIDs = (
      await this.userConnectionService.getConnections({
        where: {
          insId: {
            in: ins,
          },
          userId: {
            not: userID,
          },
        },
      })
    ).map((connection) => {
      return { id: connection.userId };
    });
    await this.notificationService.createNotification({
      source: NotificationSource.POST,
      targets: {
        connect: targetIDs,
      },
      author: {
        connect: {
          id: userID,
        },
      },
      post: {
        connect: {
          id: post.id,
        },
      },
    });

    this.logger.log(
      `Send message by user ${userID} in inses ${ins} with new post ${postID}`,
    );
    await this.chatService.sendMessageWhenPost(ins, userID, postID);

    this.logger.log('Post shared');
    return {
      message: 'Post shared!',
    };
  }
}
