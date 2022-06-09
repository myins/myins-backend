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
import { MediaConnectionsService } from 'src/media/media.connections.service';
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
    private readonly mediaConnectionsService: MediaConnectionsService,
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

  async getMediaForStory(userID: string, insID: string, storyID: string) {
    const story = await this.story(
      {
        id: storyID,
      },
      {
        author: {
          select: ShallowUserSelect,
        },
        mediaContent: {
          include: {
            views: {
              where: {
                id: userID,
                insId: insID,
              },
            },
            likes: {
              where: {
                id: userID,
                insId: insID,
              },
            },
          },
        },
      },
    );

    const ins = await this.insService.ins({
      id: insID,
    });

    const castedStory = <
      Story & {
        author: User;
        mediaContent: PostContent[];
      }
    >story;
    return Promise.all(
      castedStory.mediaContent.map(async (media) => {
        const views = await this.mediaConnectionsService.countViews({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });
        const likes = await this.mediaConnectionsService.countLikes({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });
        return {
          media: {
            ...media,
            _count: {
              likes,
              views,
            },
          },
          author: castedStory.author,
          ins: ins,
        };
      }),
    );
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

    const medias = await this.mediaService.getMedias({
      where: this.storyMediaWhereQuery(insID, highlight, userID),
      include: {
        story: {
          include: {
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
                }
              : undefined,
          },
        },
        views: {
          where: {
            id: userID,
            insId: insID,
          },
        },
        likes: {
          where: {
            id: userID,
            insId: insID,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    this.logger.log('Counting views and likes for every story media');
    let returnedMediaContent: {
      media: PostContent & {
        story: Story;
      };
    }[] = [];

    const castedMedias = <
      (PostContent & {
        story: Story & {
          inses: (StoryInsConnection & {
            ins: INS;
          })[];
          author: User;
        };
      })[]
    >medias;
    await Promise.all(
      castedMedias.map(async (media) => {
        let myIns = ins;
        if (!myIns) {
          let index = 0;
          myIns = media.story.inses[index]?.ins;
          while (myIns && media.excludedInses.includes(myIns.id)) {
            index++;
            myIns = media.story.inses[index]?.ins;
          }
        }

        if (!myIns) {
          return;
        }

        const views = await this.mediaConnectionsService.countViews({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });
        const likes = await this.mediaConnectionsService.countLikes({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });

        const lastViews = await this.mediaConnectionsService.getViews({
          where: {
            storyMediaId: media.id,
            insId: insID,
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
        });

        const castedLastViews = <
          (UserStoryMediaViewConnection & {
            user: User;
          })[]
        >lastViews;
        const mediaContent = {
          media: {
            ...media,
            _count: {
              views: views,
              likes: likes,
            },
          },
          author: media.story.author,
          ins: myIns,
          lastViews: castedLastViews.map((view) => view.user),
        };
        returnedMediaContent.push(mediaContent);
      }),
    );

    returnedMediaContent = returnedMediaContent.sort((media1, media2) => {
      const createdAt1 = media1.media.story.createdAt.getTime();
      const createdAt2 = media2.media.story.createdAt.getTime();
      if (createdAt1 === createdAt2) {
        const createdAtMedia1 = media1.media.createdAt.getTime();
        const createdAtMedia2 = media2.media.createdAt.getTime();
        return createdAtMedia1 - createdAtMedia2;
      }
      return createdAt1 - createdAt2;
    });

    const returnedMediaContentWithoutStory = returnedMediaContent.map(
      (mediaContent) => {
        return {
          ...mediaContent,
          media: omit(mediaContent.media, 'story'),
        };
      },
    );

    return returnedMediaContentWithoutStory.slice(skip, skip + take);
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

    let medias = await this.mediaService.getMedias({
      where: this.storyMediaWhereQuery(insID, highlight, null),
      include: {
        story: {
          include: {
            author: {
              select: ShallowUserSelect,
            },
          },
        },
        views: {
          where: {
            id: userID,
            insId: insID,
          },
        },
        likes: {
          where: {
            id: userID,
            insId: insID,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    medias = medias.filter((media) => !media.excludedInses.includes(insID));

    const castedMedias = <
      (PostContent & {
        story: Story & {
          author: User;
        };
      })[]
    >medias;
    let returnedMediaContent: {
      media: PostContent & {
        story: Story;
      };
    }[] = [];
    await Promise.all(
      castedMedias.map(async (media) => {
        const views = await this.mediaConnectionsService.countViews({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });
        const likes = await this.mediaConnectionsService.countLikes({
          where: {
            storyMediaId: media.id,
            insId: insID,
          },
        });

        const lastViews = await this.mediaConnectionsService.getViews({
          where: {
            storyMediaId: media.id,
            insId: insID,
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
        });

        const castedLastViews = <
          (UserStoryMediaViewConnection & {
            user: User;
          })[]
        >lastViews;
        const mediaContent = {
          media: {
            ...media,
            _count: {
              views: views,
              likes: likes,
            },
          },
          author: media.story.author,
          ins,
          lastViews: castedLastViews.map((view) => view.user),
        };
        returnedMediaContent.push(mediaContent);
      }),
    );

    returnedMediaContent = returnedMediaContent.sort((media1, media2) => {
      const createdAt1 = media1.media.story.createdAt.getTime();
      const createdAt2 = media2.media.story.createdAt.getTime();
      if (createdAt1 === createdAt2) {
        const createdAtMedia1 = media1.media.createdAt.getTime();
        const createdAtMedia2 = media2.media.createdAt.getTime();
        return createdAtMedia1 - createdAtMedia2;
      }
      return createdAt1 - createdAt2;
    });

    const returnedMediaContentWithoutStory = returnedMediaContent.map(
      (mediaContent) => {
        return {
          ...mediaContent,
          media: omit(mediaContent.media, 'story'),
        };
      },
    );

    return returnedMediaContentWithoutStory.slice(skip, skip + take);
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
                insId: castedIns.id,
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
          (media) => media && !media.excludedInses.includes(castedIns.id),
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
        if (mediaContent) {
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
        }
        return null;
      }),
    );

    this.logger.log('Sort inses by created date of first media content');
    let sortedInses = insWithMedia.sort((ins1, ins2) => {
      const time1 = ins1?.mediaContent?.createdAt.getTime() ?? 1;
      const time2 = ins2?.mediaContent?.createdAt.getTime() ?? 1;
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

  storyMediaWhereQuery(
    insID: string,
    highlight: boolean,
    userID: string | null,
  ): Prisma.PostContentWhereInput {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const whereQuery: Prisma.PostContentWhereInput = {
      story: {
        inses: insID
          ? {
              some: {
                id: insID,
              },
            }
          : undefined,
        authorId: userID ?? undefined,
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

    return whereQuery;
  }
}
