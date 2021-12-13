import {
  NotificationSource,
  Post,
  PostContent,
  Prisma,
  Story,
} from '.prisma/client';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { NotificationService } from 'src/notification/notification.service';
import { PostService } from 'src/post/post.service';
import {
  PostStoryWithInsesAndCountMedia,
  PostStoryWithInsesAndCountMediaInclude,
} from 'src/prisma-queries-helper/post-include-inses-and-count-media';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { StoryService } from 'src/story/story.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import * as uuid from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService, // private readonly ffmpegService: FfmpegService,
    @Inject(forwardRef(() => InsService))
    private readonly insService: InsService,
    private readonly postService: PostService,
    @Inject(forwardRef(() => StoryService))
    private readonly storyService: StoryService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async getMediaById(
    where: Prisma.PostContentWhereUniqueInput,
  ): Promise<PostContent | null> {
    return this.prismaService.postContent.findUnique({
      where,
    });
  }

  async firstPostContent(
    params: Prisma.PostContentFindFirstArgs,
  ): Promise<PostContent | null> {
    return this.prismaService.postContent.findFirst(params);
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

  async updateMedia(
    params: Prisma.PostContentUpdateArgs,
  ): Promise<PostContent> {
    return this.prismaService.postContent.update(params);
  }

  async attachMedia(
    file: Express.Multer.File,
    thumbnail: Express.Multer.File | undefined,
    entityID: string,
    isStoryEntity: boolean,
    isHighlight: boolean,
    userID: string | null,
    postInfo: PostInformation,
  ) {
    let entityPossibleNull: Post | Story | null = null;
    if (isStoryEntity) {
      entityPossibleNull = await this.storyService.story(
        {
          id: entityID,
        },
        <Prisma.StoryInclude>PostStoryWithInsesAndCountMediaInclude,
      );
    } else {
      entityPossibleNull = await this.postService.post(
        {
          id: entityID,
        },
        <Prisma.PostInclude>PostStoryWithInsesAndCountMediaInclude,
      );
    }
    const entity = entityPossibleNull;
    if (!entity) {
      this.logger.error(
        `Could not find ${isStoryEntity ? 'story' : 'post'} ${entityID}!`,
      );
      throw new NotFoundException(
        `Could not find ${isStoryEntity ? 'story' : 'post'}!`,
      );
    }
    if (userID && entity.authorId && entity.authorId !== userID) {
      this.logger.error(`That's not your ${isStoryEntity ? 'story' : 'post'}!`);
      throw new BadRequestException(
        `That's not your ${isStoryEntity ? 'story' : 'post'}!`,
      );
    }

    const existingContent =
      (<PostStoryWithInsesAndCountMedia>entity)._count?.mediaContent ?? 0;
    if (existingContent + 1 > entity.totalMediaContent) {
      this.logger.error('There are too many medias attached already!');
      throw new BadRequestException(
        'There are too many medias attached already!',
      );
    }

    let thumbnailURL: string | undefined = undefined;
    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const entityName = `${
      isStoryEntity ? 'story' : 'post'
    }_${entityID}_${randomUUID}${ext}`;

    if (postInfo.isVideo && thumbnail) {
      const thumbnailName = `${
        isStoryEntity ? 'story' : 'post'
      }_${entityID}_thumb_${randomUUID}.jpg`;

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
        isStoryEntity ? StorageContainer.stories : StorageContainer.posts,
      );
    }

    let x = file;
    x = {
      ...x,
      originalname: entityName,
    };
    this.logger.log(`Uploading file to S3 with original name '${entityName}'`);
    const dataURL = await this.storageService.uploadFile(
      x,
      isStoryEntity ? StorageContainer.stories : StorageContainer.posts,
    );

    this.logger.log(
      `Creating new media for ${
        isStoryEntity ? 'story' : 'post'
      } ${entityID} with content '${dataURL}'`,
    );
    const toRet = await this.create({
      content: dataURL,
      post: !isStoryEntity
        ? {
            connect: {
              id: entityID,
            },
          }
        : undefined,
      story: isStoryEntity
        ? {
            connect: {
              id: entityID,
            },
          }
        : undefined,
      thumbnail: thumbnailURL,
      width: postInfo.width,
      height: postInfo.height,
      isVideo: postInfo.isVideo,
      isHighlight,
    });

    // Time to update the post's pending state. This is a transaction in case we add async loading
    // And 2 pictures get uploaded at aprox the same time.
    await this.prismaService.$transaction(async () => {
      // Find an available ticket

      let transactionEntityPossibleNull: Post | Story | null = null;
      if (isStoryEntity) {
        transactionEntityPossibleNull = await this.storyService.story(
          {
            id: entity.id,
          },
          <Prisma.StoryInclude>PostStoryWithInsesAndCountMediaInclude,
        );
      } else {
        transactionEntityPossibleNull = await this.postService.post(
          {
            id: entity.id,
          },
          <Prisma.PostInclude>PostStoryWithInsesAndCountMediaInclude,
        );
      }
      const transactionEntity = transactionEntityPossibleNull;
      if (!transactionEntity) {
        this.logger.error(
          `Could not find ${isStoryEntity ? 'story' : 'post'} ${entity.id}!`,
        );
        throw new NotFoundException(
          `Could not find ${isStoryEntity ? 'story' : 'post'}!`,
        );
      }
      if (!transactionEntity.pending) {
        this.logger.log(
          `${isStoryEntity ? 'Story' : 'Post'} isn't pending, returning early!`,
        );
        return; // Nothing to do here, looks like the other thread
      }

      const realMediaCount =
        (<PostStoryWithInsesAndCountMedia>transactionEntity)._count
          ?.mediaContent ?? 0;
      const isReady = realMediaCount >= transactionEntity.totalMediaContent;

      if (!isReady) {
        this.logger.log(
          `${isStoryEntity ? 'Story' : 'Post'} isn't ready, returning early!`,
        );
        return; // Nothing to do here, it's not ready yet
      }

      this.logger.log(
        `Updating ${isStoryEntity ? 'story' : 'post'} ${
          entity.id
        }. Setting pending to false`,
      );
      let updatedEntity: Post | Story | null = null;
      if (isStoryEntity) {
        updatedEntity = await this.storyService.updateStory({
          data: {
            pending: false,
          },
          where: {
            id: entity.id,
          },
          include: <Prisma.StoryInclude>PostStoryWithInsesAndCountMediaInclude,
        });
      } else {
        updatedEntity = await this.postService.updatePost({
          data: {
            pending: false,
          },
          where: {
            id: entity.id,
          },
          include: <Prisma.PostInclude>PostStoryWithInsesAndCountMediaInclude,
        });
      }

      if (
        !isStoryEntity &&
        updatedEntity.authorId &&
        (<PostStoryWithInsesAndCountMedia>updatedEntity).inses.length
      ) {
        const inses = (<PostStoryWithInsesAndCountMedia>updatedEntity).inses;
        this.logger.log(`Creating notification for adding post ${toRet.id}`);
        const targetIDs = (
          await this.userConnectionService.getConnections({
            where: {
              insId: {
                in: inses.map((ins) => ins.id),
              },
              userId: {
                not: updatedEntity.authorId,
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
              id: updatedEntity.authorId,
            },
          },
          post: {
            connect: {
              id: entity.id,
            },
          },
        });

        this.logger.log(
          `Send message by user ${updatedEntity.authorId} in inses 
          ${inses.map((ins: { id: string }) => ins.id)} with new posts ${
            updatedEntity.id
          }`,
        );
        await this.chatService.sendMessageWhenPost(
          inses.map((ins: { id: string }) => ins.id),
          updatedEntity.authorId,
          updatedEntity.id,
        );
      }
    });

    if (postInfo.setCover && !postInfo.isVideo) {
      this.logger.log(
        `Updating inses ${(<PostStoryWithInsesAndCountMedia>entity).inses.map(
          (ins) => ins.id,
        )}. Setting cover '${dataURL}'`,
      );
      for (const eachINS of (<PostStoryWithInsesAndCountMedia>entity).inses) {
        await this.insService.update({
          where: eachINS,
          data: {
            cover: dataURL,
          },
        });
      }
    }

    this.logger.log(`Successfully attached media for post ${entityID}`);
    return toRet;
  }

  async deleteMedia(
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
