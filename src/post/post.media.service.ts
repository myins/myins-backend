import { BadRequestException, Injectable } from '@nestjs/common';
import * as path from 'path';
import { FfmpegService } from 'src/ffmpeg/ffmpeg.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostMediaService {
  constructor(
    private prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly ffmpegService: FfmpegService,
  ) {}

  async attachMediaToPost(
    file: Express.Multer.File,
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

    let thumbnail: string | undefined = undefined;

    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const postName = `post_${postID}_${randomUUID}${ext}`;

    if (postInfo.isVideo) {
      const thumbnailName = `post_${postID}_thumb_${randomUUID}.jpg`;
      const thumbnailFile = await this.ffmpegService.generateThumbnail(file);

      thumbnail = await this.storageService.uploadBuffer(
        thumbnailFile,
        thumbnailName,
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

    const toRet = await this.prismaService.postContent.create({
      data: {
        content: dataURL,
        postId: postID,
        thumbnail: thumbnail,
        width: postInfo.width,
        height: postInfo.height,
        isVideo: postInfo.isVideo,
      },
    });

    // Time to update the post's pending state. This is a transaction in case we add async loading
    // And 2 pictures get uploaded at aprox the same time.
    await this.prismaService.$transaction(async (prisma) => {
      // Find an available ticket

      const transactionPost = await this.prismaService.post.findUnique({
        where: { id: post.id },
        include: {
          _count: {
            select: {
              mediaContent: true,
            },
          },
        },
      });

      if (!transactionPost) {
        throw new BadRequestException(
          'Could not find the post for some reason!',
        );
      }
      if (!transactionPost.pending) {
        return; // Nothing to do here, looks like the other thread
      }

      const isReady =
        transactionPost.totalMediaContent >=
        (transactionPost._count?.mediaContent ?? 0);

      if (!isReady) {
        return; // Nothing to do here, it's not ready yet
      }

      return prisma.post.update({
        data: {
          pending: isReady,
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
}

interface PostInformation {
  width: number;
  height: number;
  isVideo: boolean;
  setCover: boolean;
}
