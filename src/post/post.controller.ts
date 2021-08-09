import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Post as PostModel } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PostService } from 'src/post/post.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { UserService } from 'src/user/user.service';
import { isVideo, photoOrVideoInterceptor } from 'src/util/multer';
import { CreatePostAPI } from './post-api.entity';
import * as path from 'path';
import { PatchCommentAPI } from 'src/comment/comment-api.entity';
import * as uuid from 'uuid';
import * as fs from 'fs';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
  ) { }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getPostById(@Param('id') id: string, @UserID() userID: string): Promise<PostModel | null> {
    return this.postService.injectedPost(id, userID)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  @UseInterceptors(photoOrVideoInterceptor)
  async createPost(
    @Body() postData: CreatePostAPI,
    @UserID() userID: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Could not find post file!');
    }
    if (postData.content == null || postData.content == undefined) {
      throw new BadRequestException("Content must be empty, not missing!")
    }
    file.buffer = fs.readFileSync(file.path);

    const user = await this.userService.user({ id: userID });
    if (!user) {
      throw new BadRequestException('Could not find your user!');
    }
    if (!user.phoneNumberVerified) {
      throw new BadRequestException(
        'Please verify your phone before creating posts!',
      );
    }
    const isVideoPost = isVideo(file.originalname);

    try {
      const ext = path.extname(file.originalname);
      const randomUUID = uuid.v4();

      let x = file;
      x = {
        ...x,
        originalname: `post_${randomUUID}${ext}`,
      };
      const dataURL = await this.storageService.uploadFile(
        x,
        StorageContainer.posts,
      );
      return await this.postService.createPost({
        content: postData.content,
        author: {
          connect: {
            id: userID,
          },
        },
        mediaContent: {
          createMany: {
            data: [{
              isVideo: isVideoPost,
              content: dataURL
            }]
          }
        },
      });
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err; // If it's a bad request, just forward it
      } else {
        console.log(err);
        throw new BadRequestException(`Error creating post! ${err}`);
      }
    }
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
