import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { PERIODS } from 'src/util/enums';
import { createObjForAreaChart, getDatesByType } from 'src/util/reporting';
import { UserService } from './user.service';

@Injectable()
export class UserReportingService {
  constructor(
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getNewAccounts(type: PERIODS, startDate: string, endDate: string) {
    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.userService.users({
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0].createdAt;
    }

    const users = await this.userService.users({
      where: {
        createdAt: {
          gte: dates.gteValue,
          lte: dates.lteValue,
        },
        phoneNumberVerified: true,
        lastAcceptedTermsAndConditionsVersion: {
          not: null,
        },
        lastAcceptedPrivacyPolicyVersion: {
          not: null,
        },
      },
    });

    const deletedAccounts = await this.analyticsService.getDeletedAccount();
    const creatdAtFromDeletedAccounts = deletedAccounts.map(
      (deletedAccount) => {
        const metadata = deletedAccount.metadata as Prisma.JsonObject;
        const time = metadata?.createdAtAccUser
          ? new Date(<string>metadata.createdAtAccUser)
          : deletedAccount.createdAt;
        return time;
      },
    );

    const toRet = createObjForAreaChart(
      users.map((user) => user.createdAt).concat(creatdAtFromDeletedAccounts),
      type,
      dates.gteValue,
      dates.lteValue,
    );

    return toRet;
  }
}
