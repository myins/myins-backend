import {
  INS,
  PostContent,
  Prisma,
  Story,
  StoryInsConnection,
  User,
  UserRole,
  UserStoryMediaViewConnection,
} from '.prisma/client';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InsService } from 'src/ins/ins.service';
import { MediaService } from 'src/media/media.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
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

  async count(where: Prisma.StoryWhereInput): Promise<number> {
    return this.prisma.story.count({ where });
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
    let ins: INS | null;
    if (insID) {
      ins = await this.insService.ins({
        id: insID,
      });
    }
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const whereQuery: Prisma.StoryWhereInput = {
      authorId: userID,
      inses: insID
        ? {
            some: {
              id: insID,
            },
          }
        : undefined,
    };
    if (highlight) {
      whereQuery.mediaContent = {
        some: {
          isHighlight: highlight,
        },
      };
    } else {
      whereQuery.mediaContent = {
        some: {
          createdAt: {
            gt: date,
          },
        },
      };
    }

    const myStories = await this.stories({
      where: whereQuery,
      include: {
        mediaContent: {
          where: highlight
            ? {
                isHighlight: highlight,
              }
            : {
                createdAt: {
                  gt: date,
                },
              },
          orderBy: {
            createdAt: 'asc',
          },
        },
        author: {
          select: ShallowUserSelect,
        },
        inses: !insID
          ? {
              where: {
                ins: {
                  members: {
                    some: {
                      userId: userID,
                    },
                  },
                },
              },
              select: {
                ins: {
                  select: ShallowINSSelect,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
              take: 1,
            }
          : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    // https://www.prisma.io/docs/concepts/components/prisma-client/aggregation-grouping-summarizing#count-relations
    // Due to the line: the _count parameter Can be used inside a top-level include or select
    this.logger.log('Counting views and likes for every story media');
    const returnedMediaContent: {
      media: PostContent & {
        _count: { likes: number };
      };
      author: User;
      ins: INS | null;
    }[] = [];

    await Promise.all(
      myStories.map(async (story) => {
        const castedStory = <
          Story & {
            mediaContent: PostContent[];
            author: User;
            inses: (StoryInsConnection & {
              ins: INS;
            })[];
          }
        >story;

        const myIns = ins ?? castedStory.inses[0].ins;
        if (insID) {
          castedStory.mediaContent = castedStory.mediaContent.filter(
            (media) => !media.excludedInses.includes(insID),
          );
        }
        await Promise.all(
          castedStory.mediaContent.map(async (media) => {
            const mediaInfo = await this.mediaService.getMediaById(
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
                views: {
                  where: {
                    storyMediaId: media.id,
                  },
                  include: {
                    user: {
                      select: ShallowUserSelect,
                    },
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 3,
                },
              },
            );
            const castedMediaInfo = <
              PostContent & {
                _count: {
                  likes: number;
                  views: number;
                };
                views: (UserStoryMediaViewConnection & {
                  user: User;
                })[];
              }
            >mediaInfo;
            const mediaContent = {
              media: {
                ...media,
                _count: castedMediaInfo._count,
              },
              author: castedStory.author,
              ins: myIns,
              lastViews: castedMediaInfo.views.map((view) => view.user),
            };
            returnedMediaContent.push(mediaContent);
          }),
        );
      }),
    );

    return returnedMediaContent;
  }

  async getFeed(userID: string, skip: number, take: number) {
    this.logger.log(`Getting all ins connections for user ${userID}`);
    const date = new Date();
    date.setDate(date.getDate() - 1);
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
            story: {
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
      },
      include: {
        stories: {
          select: {
            storyId: true,
          },
        },
      },
    });

    this.logger.log(
      `Getting first media content for every ins from ins connections for user ${userID}`,
    );
    const insWithMedia = await Promise.all(
      allMyINS.map(async (ins) => {
        const castedIns = <
          INS & {
            stories: {
              storyId: string;
            }[];
          }
        >ins;

        let medias = await this.mediaService.getMedias({
          where: {
            storyId: {
              in: castedIns.stories.map((story) => story.storyId),
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
            story: {
              select: {
                authorId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        medias = medias.filter(
          (media) => !media.excludedInses.includes(castedIns.id),
        );

        const castedMedias = <
          (PostContent & {
            views: User[];
            story: Story;
          })[]
        >medias;
        const sortedMedias = castedMedias.sort((media1, media2) => {
          const views1 = media1.views.length;
          const views2 = media2.views.length;
          return views1 - views2;
        });

        let allMediasFromStory: (PostContent & {
          views: User[];
          story: Story;
        })[] = [];
        let mediaContent = sortedMedias[0];
        if (!mediaContent.views.length) {
          allMediasFromStory = sortedMedias.filter(
            (media) =>
              media.storyId === mediaContent.storyId && !media.views.length,
          );
        } else {
          allMediasFromStory = sortedMedias.filter(
            (media) => media.storyId === mediaContent.storyId,
          );
        }
        if (allMediasFromStory.length > 1) {
          const sorteAllMediasFromStory = allMediasFromStory.sort(
            (media1, media2) => {
              const createdAt1 = media1.createdAt.getTime();
              const createdAt2 = media2.createdAt.getTime();
              return createdAt1 - createdAt2;
            },
          );
          mediaContent = sorteAllMediasFromStory[0];
        }

        const unviewedStories = castedMedias.filter(
          (media) => !media.views.length && media.story.authorId !== userID,
        ).length;

        if (medias.length) {
          return {
            ...omit(castedIns, 'stories'),
            mediaContent: omit(mediaContent, 'views'),
            unviewedStories,
            countStory: medias.length,
          };
        }
        return null;
      }),
    );

    this.logger.log('Sort inses by created date of first media content');
    let sortedInses = insWithMedia.sort((ins1, ins2) => {
      const time1 = ins1?.mediaContent.createdAt.getTime() ?? 1;
      const time2 = ins2?.mediaContent.createdAt.getTime() ?? 1;
      return time2 - time1;
    });
    const notNullInses = sortedInses.filter((each) => each != null);
    sortedInses = [
      ...notNullInses.filter((ins) => ins?.unviewedStories !== 0),
      ...notNullInses.filter((ins) => ins?.unviewedStories === 0),
    ];

    const castedFinalInses = <
      (INS & {
        mediaContent: PostContent;
      })[]
    >sortedInses;
    const finalInses = castedFinalInses.map((ins) => omit(ins, 'mediaContent'));
    return finalInses.slice(skip, skip + take);
  }

  async getStoriesForINS(
    skip: number,
    take: number,
    userID: string,
    insID: string,
    highlight: boolean,
  ) {
    const ins = await this.insService.ins({
      id: insID,
    });

    this.logger.log(`Getting all viewed story connection to ins ${insID}`);
    const unviewedStory = await this.stories(
      this.storyQuery(insID, userID, skip, take, highlight, false),
    );
    this.logger.log(`Getting all unviewed story connection to ins ${insID}`);
    let viewedStory: Story[] = [];
    if (unviewedStory.length < take) {
      const whereQuery = this.storyWhereQuery(insID, userID, highlight, false);
      const countViewed = await this.count(whereQuery);
      const newSkip = skip > countViewed ? skip - countViewed : 0;
      const newTake = take - unviewedStory.length;
      viewedStory = await this.stories(
        this.storyQuery(insID, userID, newSkip, newTake, highlight, true),
      );
    }

    // https://www.prisma.io/docs/concepts/components/prisma-client/aggregation-grouping-summarizing#count-relations
    // Due to the line: the _count parameter Can be used inside a top-level include or select
    this.logger.log('Counting likes for every story media');
    const allStory = [...unviewedStory, ...viewedStory];
    const returnedMediaContent: {
      media: PostContent;
      author: User;
    }[] = [];
    await Promise.all(
      allStory.map(async (story) => {
        const castedStory = <
          Story & {
            mediaContent: PostContent[];
            author: User;
          }
        >story;
        castedStory.mediaContent = castedStory.mediaContent.filter(
          (media) => !media.excludedInses.includes(insID),
        );
        await Promise.all(
          castedStory.mediaContent.map(async (media) => {
            const mediaInfo = await this.mediaService.getMediaById(
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
                views: {
                  where: {
                    storyMediaId: media.id,
                  },
                  include: {
                    user: {
                      select: ShallowUserSelect,
                    },
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 3,
                },
              },
            );
            const castedMediaInfo = <
              PostContent & {
                _count: {
                  likes: number;
                  views: number;
                };
                views: (UserStoryMediaViewConnection & {
                  user: User;
                })[];
              }
            >mediaInfo;
            const mediaContent = {
              media: {
                ...media,
                _count: castedMediaInfo._count,
              },
              author: castedStory.author,
              ins,
              lastViews: castedMediaInfo.views.map((view) => view.user),
            };
            returnedMediaContent.push(mediaContent);
          }),
        );
      }),
    );

    return returnedMediaContent;
  }

  storyQuery(
    insID: string,
    userID: string,
    skip: number,
    take: number,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.StoryFindManyArgs {
    const whereQuery = this.storyWhereQuery(insID, userID, highlight, viewed);

    return {
      where: whereQuery,
      include: {
        mediaContent: {
          where: this.storyMediaWhereQuery(insID, userID, highlight, viewed),
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
          },
          orderBy: {
            createdAt: 'asc',
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

  storyWhereQuery(
    insID: string,
    userID: string,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.StoryWhereInput {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const whereQuery: Prisma.StoryWhereInput = {
      inses: {
        some: {
          id: insID,
        },
      },
      pending: false,
    };

    if (highlight) {
      whereQuery.mediaContent = {
        some: {
          isHighlight: highlight,
        },
      };
    } else {
      whereQuery.mediaContent = {
        some: {
          createdAt: {
            gt: date,
          },
        },
      };
    }

    whereQuery.mediaContent = {
      ...whereQuery.mediaContent,
      some: {
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
    };

    return whereQuery;
  }

  storyMediaWhereQuery(
    insID: string,
    userID: string,
    highlight: boolean,
    viewed: boolean,
  ): Prisma.PostContentWhereInput {
    const date = new Date();
    date.setDate(date.getDate() - 1);
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
