import { Injectable } from '@nestjs/common';
import { AnalyticsType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PERIODS } from 'src/util/enums';
import {
  calculatePercentage,
  createObjForAreaChart,
  getDatesByType,
  getPrevDatesByType,
} from 'src/util/reporting';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAnalytic(data: Prisma.AnalyticsCreateInput) {
    return this.prisma.analytics.create({
      data: data,
    });
  }

  async analytics(params: Prisma.AnalyticsFindManyArgs) {
    return this.prisma.analytics.findMany(params);
  }

  async groupBy(
    byParam: Prisma.AnalyticsScalarFieldEnum[],
    whereParam: Prisma.AnalyticsWhereInput,
  ) {
    return this.prisma.analytics.groupBy({
      by: byParam,
      where: whereParam,
      _sum: {
        count: true,
      },
    });
  }

  async getAnalytics(
    type: PERIODS,
    startDate: Date,
    endDate: Date,
    analyticTypes: AnalyticsType[],
  ) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.analytics({
          where: {
            type: {
              in: analyticTypes,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
    }

    if (dates.gteValue) {
      const createdAtQuery = {
        gte: dates.gteValue,
        lte: dates.lteValue,
      };

      if (analyticTypes.includes(AnalyticsType.DELETED_ACCOUNT)) {
        const analytics = await this.analytics({
          where: {
            type: {
              in: analyticTypes,
            },
            createdAt: createdAtQuery,
          },
        });
        const response = createObjForAreaChart(
          analytics.map((analytic) => analytic.createdAt),
          type,
          dates.gteValue,
          dates.lteValue,
        );

        return response;
      }

      const analyticsGroupBy = await this.groupBy(['type'], {
        type: {
          in: analyticTypes,
        },
        createdAt: createdAtQuery,
      });

      const dataRes = {
        invitesMyInsUser:
          analyticsGroupBy.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.INVITE_MYINS_USER,
          )?._sum.count ?? 0,
        invitesNonUser:
          analyticsGroupBy.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.INVITE_NON_USER,
          )?._sum.count ?? 0,
        acceptedMyInsUser:
          analyticsGroupBy.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.ACCEPTED_MYINS_USER,
          )?._sum.count ?? 0,
        acceptedNonUser:
          analyticsGroupBy.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.ACCEPTED_NON_USER,
          )?._sum.count ?? 0,
        invitesPercentMyInsUser: 0,
        invitesPercentNonUser: 0,
        acceptedPercentMyInsUser: 0,
        acceptedPercentNonUser: 0,
        totalInvitesPercent: 0,
        totalAcceptedPercent: 0,
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
        const analyticsGroupByPrev = await this.groupBy(['type'], {
          type: {
            in: analyticTypes,
          },
          createdAt: createdAtQueryPrev,
        });

        const invitesPrevMyInsUser =
          analyticsGroupByPrev.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.INVITE_MYINS_USER,
          )?._sum.count ?? 0;
        const invitesPrevNonUser =
          analyticsGroupByPrev.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.INVITE_NON_USER,
          )?._sum.count ?? 0;
        const acceptedPrevMyInsUser =
          analyticsGroupByPrev.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.ACCEPTED_MYINS_USER,
          )?._sum.count ?? 0;
        const acceptedPrevNonUser =
          analyticsGroupByPrev.find(
            (analyticGroupBy) =>
              analyticGroupBy.type === AnalyticsType.ACCEPTED_NON_USER,
          )?._sum.count ?? 0;

        dataRes.invitesPercentMyInsUser = calculatePercentage(
          invitesPrevMyInsUser,
          dataRes.invitesMyInsUser,
        );
        dataRes.invitesPercentNonUser = calculatePercentage(
          invitesPrevNonUser,
          dataRes.invitesNonUser,
        );
        dataRes.acceptedPercentMyInsUser = calculatePercentage(
          acceptedPrevMyInsUser,
          dataRes.acceptedMyInsUser,
        );
        dataRes.acceptedPercentNonUser = calculatePercentage(
          acceptedPrevNonUser,
          dataRes.acceptedNonUser,
        );
        dataRes.totalInvitesPercent = calculatePercentage(
          invitesPrevMyInsUser + invitesPrevNonUser,
          dataRes.invitesMyInsUser + dataRes.invitesNonUser,
        );
        dataRes.totalAcceptedPercent = calculatePercentage(
          acceptedPrevMyInsUser + acceptedPrevNonUser,
          dataRes.acceptedMyInsUser + dataRes.acceptedNonUser,
        );
      }

      return dataRes;
    }

    if (analyticTypes.includes(AnalyticsType.DELETED_ACCOUNT)) {
      return 0;
    }

    return {
      invitesMyInsUser: 0,
      invitesNonUser: 0,
      acceptedMyInsUser: 0,
      acceptedNonUser: 0,
      invitesPercentMyInsUser: 0,
      invitesPercentNonUser: 0,
      acceptedPercentMyInsUser: 0,
      acceptedPercentNonUser: 0,
      totalInvitesPercent: 0,
      totalAcceptedPercent: 0,
    };
  }
}
