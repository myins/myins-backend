import { Prisma, Story, UserRole } from '.prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { InsService } from 'src/ins/ins.service';
import { MediaService } from 'src/media/media.service';
import {
  InsWithStoriesID,
  InsWithStoriesIDInclude,
} from 'src/prisma-queries-helper/ins-include-stories';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PrismaService } from 'src/prisma/prisma.service';
import { omit } from 'src/util/omit';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insService: InsService,
    private readonly mediaService: MediaService,
  ) {}

  async story(
    storyWhereUniqueInput: Prisma.StoryWhereUniqueInput,
    include?: Prisma.StoryInclude,
  ): Promise<Story | null> {
    return this.prisma.story.findUnique({
      where: storyWhereUniqueInput,
      include,
    });
  }

  async stories(params: Prisma.StoryFindManyArgs): Promise<Story[]> {
    return this.prisma.story.findMany(params);
  }

  async createStory(data: Prisma.StoryCreateInput): Promise<Story> {
    return this.prisma.story.create({
      data,
    });
  }

  async updateStory(params: Prisma.StoryUpdateArgs): Promise<Story> {
    return this.prisma.story.update(params);
  }

  async deleteStory(where: Prisma.StoryWhereUniqueInput): Promise<Story> {
    return this.prisma.story.delete({
      where,
    });
  }

  async getFeed(skip: number, take: number, userID: string) {
    this.logger.log(`Getting all ins connections for user ${userID}`);
    const allMyINS = await this.insService.inses({
      where: {
        members: {
          some: {
            userId: userID,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
        stories: {
          some: {
            pending: false,
          },
        },
      },
      include: InsWithStoriesIDInclude,
      skip,
      take,
    });

    this.logger.log(
      `Getting first media content for every ins from ins connections for user ${userID}`,
    );
    const insWithMedia = await Promise.all(
      allMyINS.map(async (ins) => {
        const media = await this.mediaService.firstPostContent({
          where: {
            storyId: {
              in: (<InsWithStoriesID>ins).stories.map((story) => story.id),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (media) {
          return {
            ...omit(<InsWithStoriesID>ins, 'stories'),
            mediaContent: media,
          };
        }
        return null;
      }),
    );

    this.logger.log('Sort inses by created date of first media content');
    const toRet = insWithMedia.sort((ins1, ins2) => {
      const time1 = ins1?.mediaContent.createdAt.getTime() ?? 1;
      const time2 = ins2?.mediaContent.createdAt.getTime() ?? 1;
      return time2 - time1;
    });
    return toRet.filter((each) => each != null);
  }

  async getStoriesForINS(
    skip: number,
    take: number,
    userID: string,
    insID: string,
  ) {
    this.logger.log(`Getting all story connections for ins ${insID}`);
    const viewedStories = await this.stories({
      where: {
        inses: {
          some: {
            id: insID,
          },
        },
        pending: false,
        mediaContent: {
          some: {
            views: {
              some: {
                id: userID,
              },
            },
          },
        },
      },
      include: {
        mediaContent: {
          where: {
            views: {
              some: {
                id: userID,
              },
            },
          },
          include: {
            likes: {
              select: {
                id: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        author: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    const unviewedStories = await this.stories({
      where: {
        inses: {
          some: {
            id: insID,
          },
        },
        pending: false,
        mediaContent: {
          some: {
            views: {
              none: {
                id: userID,
              },
            },
          },
        },
      },
      include: {
        mediaContent: {
          where: {
            views: {
              none: {
                id: userID,
              },
            },
          },
          include: {
            likes: {
              select: {
                id: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        author: {
          select: ShallowUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    const allStories = [...unviewedStories, ...viewedStories];
    allStories.map((story) => {
      const castedStory = <
        Story & {
          mediaContent: {
            likes: Array<{ id: string }>;
            _count: {
              likes: number;
            };
          }[];
        }
      >story;
      castedStory.mediaContent = castedStory.mediaContent.map((media) => {
        const countLikes = media.likes.length;

        return {
          ...omit(media, 'likes'),
          likes: media.likes.filter((like) => like.id === userID),
          _count: {
            likes: countLikes,
          },
        };
      });
    });

    return allStories;
  }
}
