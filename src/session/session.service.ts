import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@prisma/client';
import { PostService } from 'src/post/post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoryService } from 'src/story/story.service';
import { UserService } from 'src/user/user.service';
import { PERIODS } from 'src/util/enums';
import {
  calculatePercentage,
  createObjForAreaChart,
  getDatesByType,
  getPrevDatesByType,
} from 'src/util/reporting';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly storyService: StoryService,
  ) {}

  async createSession(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({
      data: data,
    });
  }

  async updateSession(
    sessionID: string,
    data: Prisma.SessionUpdateInput,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: {
        id: sessionID,
      },
      data: data,
    });
  }

  async sessions(params: Prisma.SessionFindManyArgs): Promise<Session[]> {
    return this.prisma.session.findMany(params);
  }

  async getSessionDetails(type: number, startDate: string, endDate: string) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.sessions({
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
    }

    if (dates.gteValue) {
      const sessions = await this.sessions({
        where: {
          createdAt: {
            gte: dates.gteValue,
            lte: dates.lteValue,
          },
        },
      });

      const responseTotalSessions = createObjForAreaChart(
        sessions.map((session) => session.createdAt),
        type,
        dates.gteValue,
        dates.lteValue,
      );

      const uniqueSessions = [
        ...new Set(
          sessions
            .filter((session) => session.userId !== null)
            .map((session) => session.userId),
        ),
      ].length;

      const totalUsers = await this.userService.countUsers({
        where: {
          createdAt: {
            lte: dates.lteValue ?? undefined,
          },
        },
      });

      return {
        totalSessions: responseTotalSessions,
        activeUsers: uniqueSessions,
        inactiveUsers: totalUsers - uniqueSessions,
      };
    }

    return {
      totalSessions: [
        {
          date: '',
          value: 0,
        },
      ],
      activeUsers: 0,
      inactiveUsers: 0,
    };
  }

  async getActiveUsersCount(createdAtQuery: {
    gte: Date;
    lte: Date | undefined;
  }): Promise<number> {
    const sessions = await this.sessions({
      where: {
        createdAt: createdAtQuery,
      },
      distinct: ['userId'],
    });

    return sessions.filter((session) => session.userId !== null).length;
  }

  async getAvgWeeklyActiveUser(
    type: PERIODS,
    startDate: string,
    endDate: string,
  ) {
    const currDate = new Date();
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      const postsDate = (
        await this.postService.posts({
          where: {
            pending: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
      const storiesDate = (
        await this.storyService.stories({
          where: {
            pending: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
      dates.gteValue = new Date(
        Math.min.apply(null, [
          postsDate ? postsDate.getTime() : currDate.getTime(),
          storiesDate ? storiesDate.getTime() : currDate.getTime(),
        ]),
      );
    }

    if (dates.gteValue) {
      const createdAtQuery = {
        gte: dates.gteValue,
        lte: dates.lteValue,
      };

      const postsCountArray: number[] = [];
      const storiesCountArray: number[] = [];
      if (
        type === PERIODS.past24h ||
        type === PERIODS.past7d ||
        (type === PERIODS.range &&
          dates.lteValue &&
          Math.ceil(
            Math.abs(dates.lteValue.getTime() - dates.gteValue.getTime()) /
              (1000 * 60 * 60 * 24),
          ) < 7)
      ) {
        const valuesWeeklyActiveUsers = await this.weeklyActiveUsers(
          createdAtQuery,
        );
        postsCountArray.push(parseFloat(valuesWeeklyActiveUsers.posts));
        storiesCountArray.push(parseFloat(valuesWeeklyActiveUsers.stories));
      } else {
        await this.weeklyActiveUsersMultiple(
          dates,
          currDate,
          postsCountArray,
          storiesCountArray,
        );
      }

      const dataRes = {
        postsActiveUsers:
          postsCountArray.reduce((a, b) => a + b, 0) / postsCountArray.length,
        storiesActiveUsers:
          storiesCountArray.reduce((a, b) => a + b, 0) /
          storiesCountArray.length,
        postsActiveUsersPercent: 0,
        storiesActiveUsersPercent: 0,
      };

      if (type !== PERIODS.allTime) {
        const newDates = getPrevDatesByType(
          type,
          dates.gteValue,
          dates.lteValue,
        );
        const createdAtQueryPrev = {
          gte: newDates.gteValue,
          lte: newDates.lteValue,
        };
        const postsCountPrevArray: number[] = [];
        const storiesCountPrevArray: number[] = [];
        if (
          type === PERIODS.past24h ||
          type === PERIODS.past7d ||
          (type === PERIODS.range &&
            dates.lteValue &&
            Math.ceil(
              Math.abs(dates.lteValue.getTime() - dates.gteValue.getTime()) /
                (1000 * 60 * 60 * 24),
            ) < 7)
        ) {
          const valuesWeeklyActiveUsers = await this.weeklyActiveUsers(
            createdAtQueryPrev,
          );
          postsCountPrevArray.push(parseFloat(valuesWeeklyActiveUsers.posts));
          storiesCountPrevArray.push(
            parseFloat(valuesWeeklyActiveUsers.stories),
          );
        } else {
          await this.weeklyActiveUsersMultiple(
            newDates,
            currDate,
            postsCountPrevArray,
            storiesCountPrevArray,
          );
        }

        const postsActiveUsersPrev =
          postsCountPrevArray.reduce((a, b) => a + b, 0) /
          postsCountPrevArray.length;
        dataRes.postsActiveUsersPercent = calculatePercentage(
          postsActiveUsersPrev,
          dataRes.postsActiveUsers,
        );

        const storiesActiveUsersPrev =
          storiesCountPrevArray.reduce((a, b) => a + b, 0) /
          storiesCountPrevArray.length;
        dataRes.storiesActiveUsersPercent = calculatePercentage(
          storiesActiveUsersPrev,
          dataRes.storiesActiveUsers,
        );
      }

      return dataRes;
    }

    return {
      postsActiveUsers: 0,
      storiesActiveUsers: 0,
    };
  }

  async weeklyActiveUsers(createdAtQuery: {
    gte: Date;
    lte: Date | undefined;
  }) {
    const postsCount = await this.postService.count({
      where: {
        createdAt: createdAtQuery,
        pending: false,
      },
    });
    const storiesCount = await this.storyService.count({
      createdAt: createdAtQuery,
      pending: false,
    });
    const activeUsers = await this.getActiveUsersCount(createdAtQuery);

    const postsActiveUsers = (
      !activeUsers ? postsCount : postsCount / activeUsers
    ).toFixed(2);
    const storiesActiveUsers = (
      !activeUsers ? storiesCount : storiesCount / activeUsers
    ).toFixed(2);

    return {
      posts: postsActiveUsers,
      stories: storiesActiveUsers,
    };
  }

  async weeklyActiveUsersMultiple(
    dates: {
      gteValue: Date;
      lteValue: Date | undefined;
    },
    currDate: Date,
    postsCountArray: number[],
    storiesCountArray: number[],
  ) {
    const newDateLte = dates.lteValue ? new Date(dates.lteValue) : currDate;
    while (newDateLte.getTime() > dates.gteValue.getTime()) {
      const newDateGte = new Date(newDateLte);
      newDateGte.setDate(newDateLte.getDate() - 7);
      newDateGte.setSeconds(newDateGte.getSeconds() + 1);
      const realNewDateGte =
        newDateGte.getTime() > dates.gteValue.getTime()
          ? newDateGte
          : dates.gteValue;
      const valuesWeeklyActiveUsers = await this.weeklyActiveUsers({
        lte: newDateLte,
        gte: realNewDateGte,
      });
      postsCountArray.push(parseFloat(valuesWeeklyActiveUsers.posts));
      storiesCountArray.push(parseFloat(valuesWeeklyActiveUsers.stories));
      newDateLte.setDate(newDateLte.getDate() - 7);
    }
  }
}
