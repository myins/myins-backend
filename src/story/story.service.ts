import {
  INS,
  PostContent,
  Prisma,
  Story,
  User,
  UserRole,
} from '.prisma/client';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InsService } from 'src/ins/ins.service';
import { MediaService } from 'src/media/media.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PrismaService } from 'src/prisma/prisma.service';
import { omit } from 'src/util/omit';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insService: InsService,
    @Inject(forwardRef(() => MediaService))
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

  async deleteMany(params: Prisma.StoryDeleteManyArgs) {
    return this.prisma.story.deleteMany(params);
  }

  async getMyStories(
    skip: number,
    take: number,
    userID: string,
    insID: string,
    highlight: boolean,
  ) {
    const currDate = new Date();
    const date = new Date(currDate.setMonth(currDate.getMonth() - 1));
    const whereQuery: Prisma.PostContentWhereInput = {
      story: {
        authorId: userID,
        inses: insID
          ? {
              some: {
                id: insID,
              },
            }
          : undefined,
      },
    };
    if (highlight) {
      whereQuery.isHighlight = highlight;
    } else {
      whereQuery.createdAt = {
        gt: date,
      };
    }

    const myMedias = await this.mediaService.getMedias({
      where: whereQuery,
      include: {
        story: {
          include: {
            author: {
              select: ShallowUserSelect,
            },
          },
        },
        _count: {
          select: {
            likes: true,
            views: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    this.logger.log('Add author for every story media');
    const returnedMediaContent: { media: PostContent; author: User }[] = [];
    myMedias.forEach(async (media) => {
      const castedMedia = <
        PostContent & {
          story: Story & {
            author: User;
          };
        }
      >media;
      const mediaContent = {
        media: omit(castedMedia, 'story'),
        author: castedMedia.story.author,
      };
      returnedMediaContent.push(mediaContent);
    });

    return returnedMediaContent;
  }

  async getFeed(userID: string) {
    this.logger.log(`Getting all ins connections for user ${userID}`);
    const currDate = new Date();
    const date = new Date(currDate.setDate(currDate.getDate() - 1));
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
            mediaContent: {
              some: {
                createdAt: {
                  gt: date,
                },
              },
            },
          },
        },
      },
      include: {
        stories: {
          select: {
            id: true,
          },
        },
      },
    });

    this.logger.log(
      `Getting first media content for every ins from ins connections for user ${userID}`,
    );
    console.log('date', date);
    const insWithMedia = await Promise.all(
      allMyINS.map(async (ins) => {
        const castedIns = <
          INS & {
            stories: {
              id: string;
            }[];
          }
        >ins;
        const medias = await this.mediaService.getMedias({
          where: {
            storyId: {
              in: castedIns.stories.map((story) => story.id),
            },
            story: {
              pending: false,
            },
            createdAt: {
              gt: date,
            },
          },
          include: {
            views: {
              where: {
                id: userID,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const castedMedias = <
          (PostContent & {
            views: User[];
          })[]
        >medias;
        const sortedMedias = castedMedias.sort((media1, media2) => {
          const views1 = media1?.views.length ?? 0;
          const views2 = media2?.views.length ?? 0;
          return views1 - views2;
        });

        const unviewedStories = castedMedias.filter(
          (media) => !media.views.length,
        ).length;

        if (medias.length) {
          return {
            ...omit(castedIns, 'stories'),
            mediaContent: omit(sortedMedias[0], 'views'),
            unviewedStories,
            countStory: medias.length,
          };
        }
        return null;
      }),
    );

    this.logger.log('Sort inses by created date of first media content');
    const sortedInses = insWithMedia.sort((ins1, ins2) => {
      const time1 = ins1?.mediaContent.createdAt.getTime() ?? 1;
      const time2 = ins2?.mediaContent.createdAt.getTime() ?? 1;
      return time2 - time1;
    });
    const notNullInses = sortedInses.filter((each) => each != null);
    return [
      ...notNullInses.filter((ins) => ins?.unviewedStories !== 0),
      ...notNullInses.filter((ins) => ins?.unviewedStories === 0),
    ];
  }

  async getStoriesForINS(
    skip: number,
    take: number,
    userID: string,
    insID: string,
    highlight: boolean,
  ) {
    this.logger.log(
      `Getting all viewed story medias connection to ins ${insID}`,
    );
    const unviewedStoryMedias = await this.mediaService.getMedias(
      this.storyMediaQuery(insID, userID, skip, take, highlight, false),
    );
    this.logger.log(
      `Getting all unviewed story medias  connection to ins ${insID}`,
    );
    let viewedStoryMedias: PostContent[] = [];
    if (unviewedStoryMedias.length < take) {
      const whereQuery = this.storyMediaWhereQuery(
        insID,
        userID,
        highlight,
        false,
      );
      const countViewed = await this.mediaService.count(whereQuery);
      const newSkip = skip > countViewed ? skip - countViewed : 0;
      const newTake = take - unviewedStoryMedias.length;
      viewedStoryMedias = await this.mediaService.getMedias(
        this.storyMediaQuery(insID, userID, newSkip, newTake, highlight, true),
      );
    }

    this.logger.log('Add author for every story media');
    const allStoryMedias = [...unviewedStoryMedias, ...viewedStoryMedias];
    const returnedMediaContent: {
      media: PostContent;
      author: User;
    }[] = [];
    allStoryMedias.map(async (media) => {
      const castedMedia = <
        PostContent & {
          story: Story & {
            author: User;
          };
        }
      >media;
      const mediaContent = {
        media: omit(castedMedia, 'story'),
        author: castedMedia.story.author,
      };
      returnedMediaContent.push(mediaContent);
    });

    return returnedMediaContent;
  }

  storyMediaQuery(
    insID: string,
    userID: string,
    skip: number,
    take: number,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.PostContentFindManyArgs {
    const whereQuery = this.storyMediaWhereQuery(
      insID,
      userID,
      highlight,
      viewed,
    );
    return {
      where: whereQuery,
      include: {
        views: {
          where: {
            id: userID,
          },
          select: {
            id: true,
          },
        },
        likes: {
          where: {
            id: userID,
          },
          select: {
            id: true,
          },
        },
        story: {
          include: {
            author: {
              select: ShallowUserSelect,
            },
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    };
  }

  storyMediaWhereQuery(
    insID: string,
    userID: string,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.PostContentWhereInput {
    const currDate = new Date();
    const date = new Date(currDate.setMonth(currDate.getMonth() - 1));
    const whereQuery: Prisma.PostContentWhereInput = {
      story: {
        inses: {
          some: {
            id: insID,
          },
        },
        pending: false,
      },
    };
    if (highlight) {
      whereQuery.isHighlight = highlight;
    } else {
      whereQuery.createdAt = {
        gt: date,
      };
    }
    if (viewed) {
      whereQuery.views = {
        some: {
          id: userID,
        },
      };
    } else {
      whereQuery.views = {
        none: {
          id: userID,
        },
      };
    }

    return whereQuery;
  }
}
