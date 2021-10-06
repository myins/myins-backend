import { PostContent, Prisma } from '.prisma/client';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import { InsService } from 'src/ins/ins.service';
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
  ) {}

  private readonly logger = new Logger(PostMediaService.name);

  async getPostMediaById(
    where: Prisma.PostContentWhereUniqueInput,
  ): Promise<PostContent | null> {
    return this.prismaService.postContent.findUnique({
      where,
    });
  }

  async getMediaForPost(
    where: Prisma.PostContentWhereInput,
  ): Promise<PostContent[]> {
    return this.prismaService.postContent.findMany({
      where,
    });
  }

  async getMedias(
    params: Prisma.PostContentFindManyArgs,
  ): Promise<PostContent[]> {
    return this.prismaService.postContent.findMany(params);
  }

  async create(params: Prisma.PostContentCreateArgs): Promise<PostContent> {
    return this.prismaService.postContent.create(params);
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
      throw new BadRequestException('Could not find post!');
    }
    if (userID) {
      if (post.authorId && post.authorId != userID) {
        throw new BadRequestException("That's not your post!");
      }
    }
    const existingContent =
      (<PostWithInsesAndCountMedia>post)._count?.mediaContent ?? 0;
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

    const toRet = await this.create({
      data: {
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
      },
    });

    this.logger.debug('Done uploading, time to run transaction...');

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

      const realMediaCount =
        (<PostWithInsesAndCountMedia>transactionPost)._count?.mediaContent ?? 0;
      const isReady = realMediaCount >= transactionPost.totalMediaContent;

      this.logger.debug(`Is ready? ${isReady}`);
      console.log(transactionPost);

      if (!isReady) {
        this.logger.debug(`Post isn't ready, returning early!`);
        return; // Nothing to do here, it's not ready yet
      }

      this.logger.debug(`Setting pending to false!`);

      return this.postService.updatePost({
        data: {
          pending: false,
        },
        where: {
          id: post.id,
        },
      });
    });

    if (postInfo.setCover && !postInfo.isVideo) {
      for (const eachINS of (<PostWithInsesAndCountMedia>post).inses) {
        await this.insService.update({
          where: eachINS,
          data: {
            cover: dataURL,
          },
        });
      }
    }
    return toRet;
  }

  async attachMediaToPostDeprecated(
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

    // let thumbnail: string | undefined = undefined;

    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const postName = `post_${postID}_${randomUUID}${ext}`;

    // if (postInfo.isVideo) {
    //   const thumbnailName = `post_${postID}_thumb_${randomUUID}.jpg`;
    //   const thumbnailFile = await this.ffmpegService.generateThumbnail(file);

    //   thumbnail = await this.storageService.uploadBuffer(
    //     thumbnailFile,
    //     thumbnailName,
    //     StorageContainer.posts,
    //   );
    // }

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
        //thumbnail: thumbnail,
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
        await this.insService.update({
          where: eachINS,
          data: {
            cover: dataURL,
          },
        });
      }
    }
    return toRet;
  }

  async deletePostMedia(
    where: Prisma.PostContentWhereUniqueInput,
  ): Promise<PostContent | null> {
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
