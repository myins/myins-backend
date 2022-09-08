import { Injectable, Logger } from '@nestjs/common';
import { PostCreatedFrom } from '@prisma/client';
import { PERIODS } from 'src/util/enums';
import { getDatesByType } from 'src/util/reporting';
import { PostService } from './post.service';

@Injectable()
export class PostReportingService {
  private readonly logger = new Logger(PostReportingService.name);

  constructor(private readonly postService: PostService) {}

  async getTotalPosts(type: number, startDate: Date, endDate: Date) {
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

    return {
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
    };
  }
}
