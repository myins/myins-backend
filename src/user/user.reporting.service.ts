import { Injectable } from '@nestjs/common';
import { PERIODS } from 'src/util/enums';
import { createObjForAreaChart, getDatesByType } from 'src/util/reporting';
import { UserService } from './user.service';

@Injectable()
export class UserReportingService {
  constructor(private readonly userService: UserService) {}

  async getNewAccounts(type: PERIODS, startDate: Date, endDate: Date) {
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
      },
    });

    const response = createObjForAreaChart(
      users.map((user) => user.createdAt),
      type,
      dates.gteValue,
      dates.lteValue,
    );

    return response;
  }
}
