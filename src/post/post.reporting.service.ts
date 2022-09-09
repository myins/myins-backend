import { Injectable, Logger } from '@nestjs/common';
import { PostCreatedFrom } from '@prisma/client';
import { PERIODS } from 'src/util/enums';
import {
  calculatePercentage,
  getDatesByType,
  getPrevDatesByType,
} from 'src/util/reporting';
import { PostService } from './post.service';

@Injectable()
export class PostReportingService {
  private readonly logger = new Logger(PostReportingService.name);

  constructor(private readonly postService: PostService) {}

  async getTotalPosts(type: PERIODS, startDate: Date, endDate: Date) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.postService.posts({
          where: {
            pending: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0].createdAt;
    }

    if (dates.gteValue) {
      const createdAtQuery = {
        gte: dates.gteValue,
        lte: dates.lteValue,
      };
      const postsCount = await this.postService.count({
        where: {
          createdAt: createdAtQuery,
          pending: false,
        },
      });

      const postsGroupByCreatedFrom = await this.postService.groupBy(
        ['createdFrom'],
        {
          createdAt: createdAtQuery,
          pending: false,
        },
      );

      const dataRes = {
        total: postsCount,
        home:
          postsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.HOME,
          )?._count._all ?? 0,
        ins:
          postsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.INS,
          )?._count._all ?? 0,
        story:
          postsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.STORY,
          )?._count._all ?? 0,
        homePercent: 0,
        insPercent: 0,
        storyPercent: 0,
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
        const prevPostsGroupByCreatedFrom = await this.postService.groupBy(
          ['createdFrom'],
          {
            createdAt: createdAtQueryPrev,
            pending: false,
          },
        );

        const homePrev =
          prevPostsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.HOME,
          )?._count._all ?? 0;
        const insPrev =
          prevPostsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.INS,
          )?._count._all ?? 0;
        const storyPrev =
          prevPostsGroupByCreatedFrom.find(
            (postGroupBy) => postGroupBy.createdFrom === PostCreatedFrom.STORY,
          )?._count._all ?? 0;

        dataRes.homePercent = calculatePercentage(homePrev, dataRes.home);
        dataRes.insPercent = calculatePercentage(insPrev, dataRes.ins);
        dataRes.storyPercent = calculatePercentage(storyPrev, dataRes.story);
      }

      return dataRes;
    }

    return [
      {
        date: '',
        value: 0,
      },
    ];
  }
}
