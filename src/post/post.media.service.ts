import { NotificationSource, PostContent, Prisma } from '.prisma/client';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { NotificationService } from 'src/notification/notification.service';
import {
  PostWithInsesAndCountMedia,
  PostWithInsesAndCountMediaInclude,
} from 'src/prisma-queries-helper/post-include-inses-and-count-media';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { PostService } from './post.service';

@Injectable()
export class PostMediaService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService, // private readonly ffmpegService: FfmpegService,
    @Inject(forwardRef(() => InsService))
    private readonly insService: InsService,
    private readonly postService: PostService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly logger = new Logger(PostMediaService.name);

  async getPostMediaById(
    where: Prisma.PostContentWhereUniqueInput,
  ): Promise<PostContent | null> {
    return this.prismaService.postContent.findUnique({
      where,
    });
  }

  async getMedias(
    params: Prisma.PostContentFindManyArgs,
  ): Promise<PostContent[]> {
    return this.prismaService.postContent.findMany(params);
  }

  async create(data: Prisma.PostContentCreateInput): Promise<PostContent> {
    return this.prismaService.postContent.create({
      data,
    });
  }

  async attachMediaToPost(
    file: Express.Multer.File,
    thumbnail: Express.Multer.File | undefined,
    postID: string,
    userID: string | null,
    postInfo: PostInformation,
  ) {
    const post = await this.postService.post(
      {
        id: postID,
      },
      PostWithInsesAndCountMediaInclude,
    );
    if (post == null) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new BadRequestException('Could not find post!');
    }
    if (userID) {
      if (post.authorId && post.authorId != userID) {
        this.logger.error("That's not your post!");
        throw new BadRequestException("That's not your post!");
      }
    }
    const existingContent =
      (<PostWithInsesAndCountMedia>post)._count?.mediaContent ?? 0;
    if (existingContent + 1 > post.totalMediaContent) {
      this.logger.error('There are too many medias attached already!');
      throw new BadRequestException(
        'There are too many medias attached already!',
      );
    }

    let thumbnailURL: string | undefined = undefined;

    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const postName = `post_${postID}_${randomUUID}${ext}`;

    if (postInfo.isVideo && thumbnail) {
      const thumbnailName = `post_${postID}_thumb_${randomUUID}.jpg`;

      let x = thumbnail;
      x = {
        ...x,
        originalname: thumbnailName,
      };
      this.logger.log(
        `Uploading file to S3 with original name '${thumbnailName}'`,
      );
      thumbnailURL = await this.storageService.uploadFile(
        x,
        StorageContainer.posts,
      );
    }

    let x = file;
    x = {
      ...x,
      originalname: postName,
    };
    this.logger.log(`Uploading file to S3 with original name '${postName}'`);
    const dataURL = await this.storageService.uploadFile(
      x,
      StorageContainer.posts,
    );

    this.logger.log(
      `Creating new post media for post ${postID} with content '${dataURL}'`,
    );
    const toRet = await this.create({
      content: dataURL,
      post: {
        connect: {
          id: postID,
        },
      },
      thumbnail: thumbnailURL,
      width: postInfo.width,
      height: postInfo.height,
      isVideo: postInfo.isVideo,
    });

    // Time to update the post's pending state. This is a transaction in case we add async loading
    // And 2 pictures get uploaded at aprox the same time.
    await this.prismaService.$transaction(async () => {
      // Find an available ticket

      const transactionPost = await this.postService.post(
        {
          id: post.id,
        },
        PostWithInsesAndCountMediaInclude,
      );
      if (!transactionPost) {
        this.logger.error(`Could not find post ${postID}!`);
        throw new BadRequestException('Could not find the post for!');
      }
      if (!transactionPost.pending) {
        this.logger.log(`Post isn't pending, returning early!`);
        return; // Nothing to do here, looks like the other thread
      }

      const realMediaCount =
        (<PostWithInsesAndCountMedia>transactionPost)._count?.mediaContent ?? 0;
      const isReady = realMediaCount >= transactionPost.totalMediaContent;

      if (!isReady) {
        this.logger.log(`Post isn't ready, returning early!`);
        return; // Nothing to do here, it's not ready yet
      }

      this.logger.log(`Updating post ${post.id}. Setting pending to false`);
      const updatedPost = await this.postService.updatePost({
        data: {
          pending: false,
        },
        where: {
          id: post.id,
        },
        include: PostWithInsesAndCountMediaInclude,
      });

      if (
        updatedPost.authorId &&
        (<PostWithInsesAndCountMedia>updatedPost).inses.length
      ) {
        this.logger.log(
          `Creating notification for ${
            userID ? 'adding photos to' : 'adding'
          } post ${toRet.id}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.POST,
          author: {
            connect: {
              id: updatedPost.authorId,
            },
          },
          post: {
            connect: {
              id: post.id,
            },
          },
          photoCount: realMediaCount,
        });

        this.logger.log(
          `Send message by user ${userID} in inses 
          ${(<PostWithInsesAndCountMedia>updatedPost).inses.map(
            (ins: { id: string }) => ins.id,
          )} with new posts ${updatedPost.id}`,
        );
        await this.chatService.sendMessageWhenPost(
          (<PostWithInsesAndCountMedia>updatedPost).inses.map(
            (ins: { id: string }) => ins.id,
          ),
          updatedPost.authorId,
          updatedPost.id,
        );
      }
    });

    if (postInfo.setCover && !postInfo.isVideo) {
      this.logger.log(
        `Updating inses ${(<PostWithInsesAndCountMedia>post).inses.map(
          (ins) => ins.id,
        )}. Setting cover '${dataURL}'`,
      );
      for (const eachINS of (<PostWithInsesAndCountMedia>post).inses) {
        await this.insService.update({
          where: eachINS,
          data: {
            cover: dataURL,
          },
        });
      }
    }

    this.logger.log(`Successfully attached media for post ${postID}`);
    return toRet;
  }

  async deletePostMedia(
    where: Prisma.PostContentWhereUniqueInput,
  ): Promise<PostContent> {
    return this.prismaService.postContent.delete({
      where,
    });
  }
}
interface PostInformation {
  width: number;
  height: number;
  isVideo: boolean;
  setCover: boolean;
}
