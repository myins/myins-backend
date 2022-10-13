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
import fetch from 'node-fetch';
import * as moment from 'moment';

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

  async getDeletedAccount() {
    return this.analytics({
      where: {
        type: AnalyticsType.DELETED_ACCOUNT,
      },
    });
  }

  async getAnalytics(
    type: PERIODS,
    startDate: string,
    endDate: string,
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
      return [
        {
          date: '',
          value: 0,
        },
      ];
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

  async getAvgTimeToAccDelete(
    type: PERIODS,
    startDate: string,
    endDate: string,
  ) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.analytics({
          where: {
            type: AnalyticsType.DELETED_ACCOUNT,
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
      const analyticsDeletedAccount = await this.analytics({
        where: {
          createdAt: createdAtQuery,
          type: AnalyticsType.DELETED_ACCOUNT,
        },
      });
      const createdAtAccUserArray = analyticsDeletedAccount.map((analytic) => {
        const metadata = analytic.metadata as Prisma.JsonObject;
        const time = metadata?.createdAtAccUser
          ? new Date(<string>metadata.createdAtAccUser)
          : analytic.createdAt;
        return analytic.createdAt.getTime() - time.getTime();
      });

      return (
        createdAtAccUserArray.reduce((a, b) => a + b, 0) /
        createdAtAccUserArray.length
      );
    }

    return 0;
  }

  async getDownloadsAndUninstalls(
    type: PERIODS,
    startDate: string,
    endDate: string,
  ) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = new Date('03/19/2022');
    }

    if (dates.gteValue) {
      const username = process.env.APP_FIGURES_USERNAME;
      const password = process.env.APP_FIGURES_PASSWORD;
      const authAppFigures =
        'Basic ' + Buffer.from(username + ':' + password).toString('base64');

      const startFormat = moment(dates.gteValue).format('yyyy-MM-DDTHH');
      const endFormat = moment(dates.lteValue).format('yyyy-MM-DDTHH');
      let url = `https://api.appfigures.com/v2/reports/sales?products=${process.env.APP_FIGURES_PRODUCT_ID}&start_date=${startFormat}&end_date=${endFormat}`;
      if (
        (type !== PERIODS.past24h && type !== PERIODS.range) ||
        (type === PERIODS.range &&
          dates.lteValue &&
          dates.lteValue.toDateString() !== dates.gteValue.toDateString())
      ) {
        url = url + '&group_by=dates';
      }
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Client-Key': process.env.APP_FIGURES_X_CLIENT_KEY ?? '',
          Authorization: authAppFigures,
        },
      });
      const data = await response.json();

      let downloads: {
        date: string;
        value: number;
      }[] = [];
      let uninstalls: {
        date: string;
        value: number;
      }[] = [];
      if (
        (type !== PERIODS.past24h && type !== PERIODS.range) ||
        (type === PERIODS.range &&
          dates.lteValue &&
          dates.lteValue.toDateString() !== dates.gteValue.toDateString())
      ) {
        downloads = Object.keys(data).map((key) => {
          return {
            date: moment(key).format('MM/DD'),
            value: data[key].downloads,
          };
        });
        uninstalls = Object.keys(data).map((key) => {
          return {
            date: moment(key).format('MM/DD'),
            value: data[key].uninstalls,
          };
        });
      } else {
        downloads = [
          {
            date: moment(
              type === PERIODS.past24h ? new Date() : dates.gteValue,
            ).format('MM/DD'),
            value: data.downloads,
          },
        ];
        uninstalls = [
          {
            date: moment(
              type === PERIODS.past24h ? new Date() : dates.gteValue,
            ).format('MM/DD'),
            value: data.uninstalls,
          },
        ];
      }

      return {
        downloads,
        uninstalls,
      };
    }

    return 0;
  }
}
