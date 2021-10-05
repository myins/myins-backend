import { PostContent } from '.prisma/client';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
// import { FfmpegService } from 'src/ffmpeg/ffmpeg.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostMediaService {
  constructor(
    private prismaService: PrismaService,
    private readonly storageService: StorageService, // private readonly ffmpegService: FfmpegService,
  ) {}

  private readonly logger = new Logger(PostMediaService.name);

  async getPostMediaById(postMediaId: string): Promise<PostContent | null> {
    return this.prismaService.postContent.findUnique({
      where: {
        id: postMediaId,
      },
    });
  }

  async getMediaForPost(postId: string): Promise<PostContent[]> {
    return this.prismaService.postContent.findMany({
      where: {
        postId: postId,
      },
    });
  }

  async attachMediaToPost(
    file: Express.Multer.File,
    thumbnail: Express.Multer.File | undefined,
    postID: string,
    userID: string | null,
    postInfo: PostInformation,
  ) {
    const post = await this.prismaService.post.findUnique({
      where: { id: postID },
      include: {
        inses: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            mediaContent: true,
          },
        },
      },
    });
    if (post == null) {
      throw new BadRequestException('Could not find post!');
    }
    if (userID) {
      if (post.authorId && post.authorId != userID) {
        throw new BadRequestException("That's not your post!");
      }
    }
    const existingContent = post._count?.mediaContent ?? 0;
    if (existingContent + 1 > post.totalMediaContent) {
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
    const dataURL = await this.storageService.uploadFile(
      x,
      StorageContainer.posts,
    );

    this.logger.debug('Uploading new post content...');

    const toRet = await this.prismaService.postContent.create({
      data: {
        content: dataURL,
        postId: postID,
        thumbnail: thumbnailURL,
        width: postInfo.width,
        height: postInfo.height,
        isVideo: postInfo.isVideo,
      },
    });

    this.logger.debug('Done uploading, time to run transaction...');

    // Time to update the post's pending state. This is a transaction in case we add async loading
    // And 2 pictures get uploaded at aprox the same time.
    await this.prismaService.$transaction(async (prisma) => {
      // Find an available ticket

      const transactionPost = await prisma.post.findUnique({
        where: { id: post.id },
        include: {
          _count: {
            select: {
              mediaContent: true,
            },
          },
        },
      });
      this.logger.debug(`Got post, ${transactionPost?.id}`);

      if (!transactionPost) {
        throw new BadRequestException(
          'Could not find the post for some reason!',
        );
      }
      if (!transactionPost.pending) {
        this.logger.debug(`Post isn't pending, returning early!`);
        return; // Nothing to do here, looks like the other thread
      }

      const realMediaCount = transactionPost._count?.mediaContent ?? 0;
      const isReady = realMediaCount >= transactionPost.totalMediaContent;

      this.logger.debug(`Is ready? ${isReady}`);
      console.log(transactionPost);

      if (!isReady) {
        this.logger.debug(`Post isn't ready, returning early!`);
        return; // Nothing to do here, it's not ready yet
      }

      this.logger.debug(`Setting pending to false!`);

      return prisma.post.update({
        data: {
          pending: false,
        },
        where: {
          id: post.id,
        },
      });
    });

    if (postInfo.setCover && !postInfo.isVideo) {
      for (const eachINS of post.inses) {
        await this.prismaService.iNS.update({
          where: eachINS,
          data: {
            cover: dataURL,
          },
        });
      }
    }
    return toRet;
  }

  async deletePostMedia(postMediaId: string): Promise<PostContent | null> {
    return this.prismaService.postContent.delete({
      where: {
        id: postMediaId,
      },
    });
  }
}
interface PostInformation {
  width: number;
  height: number;
  isVideo: boolean;
  setCover: boolean;
}
