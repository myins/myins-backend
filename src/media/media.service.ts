import {
  INS,
  NotificationSource,
  Post,
  PostContent,
  Prisma,
  Story,
  StoryInsConnection,
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
    private readonly storageService: StorageService,
    private readonly insService: InsService,
    private readonly postService: PostService,
    private readonly storyService: StoryService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async getMediaById(
    where: Prisma.PostContentWhereUniqueInput,
    include?: Prisma.PostContentInclude,
  ): Promise<PostContent | null> {
    return this.prismaService.postContent.findUnique({
      where,
      include,
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

  async count(where: Prisma.PostContentWhereInput): Promise<number> {
    return this.prismaService.postContent.count({ where });
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
        {
          _count: {
            select: {
              mediaContent: true,
            },
          },
        },
      );
    } else {
      entityPossibleNull = await this.postService.post(
        {
          id: entityID,
        },
        {
          _count: {
            select: {
              mediaContent: true,
            },
          },
        },
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

    const castedEntityWithCount = <
      (Post | Story) & {
        _count: {
          mediaContent: number;
        };
      }
    >entity;
    const existingContent = castedEntityWithCount._count?.mediaContent ?? 0;
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
      posts: !isStoryEntity
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

    let inses: INS[] = [];
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
          {
            _count: {
              select: {
                mediaContent: true,
              },
            },
          },
        );
      } else {
        transactionEntityPossibleNull = await this.postService.post(
          {
            id: entity.id,
          },
          {
            _count: {
              select: {
                mediaContent: true,
              },
            },
          },
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
        return;
      }

      const castedTransactionEntityWithCount = <
        (Post | Story) & {
          _count: {
            mediaContent: number;
          };
        }
      >transactionEntity;
      const realMediaCount =
        castedTransactionEntityWithCount._count?.mediaContent ?? 0;
      const isReady = realMediaCount >= transactionEntity.totalMediaContent;

      if (!isReady) {
        this.logger.log(
          `${isStoryEntity ? 'Story' : 'Post'} isn't ready, returning early!`,
        );
        return;
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
          include: {
            inses: {
              select: {
                id: true,
                createdAt: true,
                ins: true,
              },
            },
            _count: {
              select: {
                mediaContent: true,
              },
            },
          },
        });
      } else {
        updatedEntity = await this.postService.updatePost({
          data: {
            pending: false,
          },
          where: {
            id: entity.id,
          },
          include: {
            ins: {
              select: {
                id: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                mediaContent: true,
              },
            },
          },
        });
      }

      if (updatedEntity.authorId) {
        if (isStoryEntity) {
          const castedUpdatedStoryEntity = <
            Story & {
              inses: (StoryInsConnection & {
                ins: INS;
              })[];
            }
          >updatedEntity;
          inses = castedUpdatedStoryEntity.inses.map(
            (insConnection) => insConnection.ins,
          );
        } else {
          const castedUpdatedStoryEntity = <
            Post & {
              ins: INS;
            }
          >updatedEntity;
          inses.push(castedUpdatedStoryEntity.ins);
        }
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

        if (targetIDs.length) {
          if (isStoryEntity) {
            this.logger.log(
              `Creating notification for adding story ${toRet.id}`,
            );
            await this.notificationService.createNotification({
              source: NotificationSource.STORY,
              targets: {
                connect: targetIDs,
              },
              author: {
                connect: {
                  id: updatedEntity.authorId,
                },
              },
              story: {
                connect: {
                  id: updatedEntity.id,
                },
              },
            });
          } else {
            this.logger.log(
              `Creating notification for adding post ${toRet.id}`,
            );
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
                  id: updatedEntity.id,
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
        }
      }
    });

    if (postInfo.setCover && !postInfo.isVideo) {
      this.logger.log(
        `Updating inses ${inses.map(
          (ins) => ins.id,
        )}. Setting cover '${dataURL}'`,
      );
      for (const eachINS of inses) {
        await this.insService.update({
          where: {
            id: eachINS.id,
          },
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

  async deleteMany(params: Prisma.PostContentDeleteManyArgs) {
    return this.prismaService.postContent.deleteMany(params);
  }
}

interface PostInformation {
  width: number;
  height: number;
  isVideo: boolean;
  setCover: boolean;
}
