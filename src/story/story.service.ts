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
    const myStories = await this.stories({
      where: {
        authorId: userID,
        inses: insID
          ? {
              some: {
                id: insID,
              },
            }
          : undefined,
        mediaContent: {
          some: highlight
            ? {
                isHighlight: highlight,
              }
            : {
                createdAt: {
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
              },
        },
      },
      include: {
        mediaContent: {
          where: highlight
            ? {
                isHighlight: highlight,
              }
            : {
                createdAt: {
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
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

    const storiesWithViewsAndLikes = await Promise.all(
      myStories.map(async (story) => {
        const castedStory = <
          Story & {
            mediaContent: PostContent[];
          }
        >story;

        castedStory.mediaContent = await Promise.all(
          castedStory.mediaContent.map(async (media) => {
            const countLikes = await this.mediaService.getMediaById(
              {
                id: media.id,
              },
              {
                _count: {
                  select: {
                    likes: true,
                    views: true,
                  },
                },
              },
            );

            const castedMedia = <
              PostContent & {
                likes: User[];
                views: User[];
              }
            >media;
            return {
              ...omit(castedMedia, 'likes', 'views'),
              _count: (<
                PostContent & {
                  _count: {
                    likes: number;
                    views: number;
                  };
                }
              >countLikes)._count,
            };
          }),
        );

        return castedStory;
      }),
    );

    return storiesWithViewsAndLikes;
  }

  async getFeed(skip: number, take: number, userID: string) {
    this.logger.log(`Getting all ins connections for user ${userID}`);
    const currDate = new Date();
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
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
              },
            },
          },
        },
      },
      include: {
        stories: {
          include: {
            mediaContent: {
              where: {
                views: {
                  none: {
                    id: userID,
                  },
                },
                createdAt: {
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
              },
            },
            _count: {
              select: {
                mediaContent: true,
              },
            },
          },
        },
      },
      skip,
      take,
    });

    this.logger.log(
      `Getting first media content for every ins from ins connections for user ${userID}`,
    );
    const insWithMedia = await Promise.all(
      allMyINS.map(async (ins) => {
        const castedIns = <
          INS & {
            stories: (Story & {
              mediaContent: PostContent[];
              _count: {
                mediaContent: number;
              };
            })[];
          }
        >ins;
        const media = await this.mediaService.firstPostContent({
          where: {
            storyId: {
              in: castedIns.stories.map((story) => story.id),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        let unviewedStories = 0;
        let countStory = 0;
        castedIns.stories.forEach((story) => {
          unviewedStories += story.mediaContent.length;
          countStory += story._count.mediaContent;
        });

        if (media) {
          return {
            ...omit(castedIns, 'stories'),
            mediaContent: media,
            unviewedStories,
            countStory,
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
    this.logger.log(`Getting all viewed stories connection to ins ${insID}`);
    const viewedStories = await this.stories(
      this.storyQueryForGetStoriesForINS(
        insID,
        userID,
        skip,
        take,
        highlight,
        true,
      ),
    );
    this.logger.log(`Getting all unviewed stories connection to ins ${insID}`);
    const unviewedStories = await this.stories(
      this.storyQueryForGetStoriesForINS(
        insID,
        userID,
        skip,
        take,
        highlight,
        false,
      ),
    );

    // https://www.prisma.io/docs/concepts/components/prisma-client/aggregation-grouping-summarizing#count-relations
    // Due to the line: the _count parameter Can be used inside a top-level include or select
    this.logger.log('Counting likes for every story media');
    const allStories = [...unviewedStories, ...viewedStories];
    const storiesWithCount = await Promise.all(
      allStories.map(async (story) => {
        const castedStory = <
          Story & {
            mediaContent: {
              id: string;
            }[];
          }
        >story;
        castedStory.mediaContent = await Promise.all(
          castedStory.mediaContent.map(async (media) => {
            const countLikes = await this.mediaService.getMediaById(
              {
                id: media.id,
              },
              {
                _count: {
                  select: {
                    likes: true,
                  },
                },
              },
            );

            return {
              ...media,
              _count: (<
                PostContent & {
                  _count: {
                    likes: number;
                  };
                }
              >countLikes)._count,
            };
          }),
        );

        return castedStory;
      }),
    );

    return storiesWithCount;
  }

  storyQueryForGetStoriesForINS(
    insID: string,
    userID: string,
    skip: number,
    take: number,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.StoryFindManyArgs {
    const currDate = new Date();
    return {
      where: {
        inses: {
          some: {
            id: insID,
          },
        },
        pending: false,
        mediaContent: {
          some: highlight
            ? {
                isHighlight: highlight,
                views: viewed
                  ? {
                      some: {
                        id: userID,
                      },
                    }
                  : {
                      none: {
                        id: userID,
                      },
                    },
              }
            : {
                createdAt: {
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
                views: viewed
                  ? {
                      some: {
                        id: userID,
                      },
                    }
                  : {
                      none: {
                        id: userID,
                      },
                    },
              },
        },
      },
      include: {
        mediaContent: {
          where: highlight
            ? {
                isHighlight: highlight,
                views: viewed
                  ? {
                      some: {
                        id: userID,
                      },
                    }
                  : {
                      none: {
                        id: userID,
                      },
                    },
              }
            : {
                createdAt: {
                  gt: new Date(currDate.setDate(currDate.getDate() - 1)),
                },
                views: viewed
                  ? {
                      some: {
                        id: userID,
                      },
                    }
                  : {
                      none: {
                        id: userID,
                      },
                    },
              },
          include: {
            likes: {
              where: {
                id: userID,
              },
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
    };
  }
}
