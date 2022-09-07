import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { PERIODS } from 'src/util/enums';
import { createObjForAreaChart } from 'src/util/reporting';
import { UserService } from './user.service';

@Injectable()
export class UserReportingService {
  private readonly logger = new Logger(UserReportingService.name);

  constructor(private readonly userService: UserService) {}

  async getNewAccounts(type: number, startDate: Date, endDate: Date) {
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - type);
    if (type === PERIODS.past7d || type === PERIODS.past30d) {
      currentDate = moment(currentDate).startOf('day').toDate();
    }
    const gteValue =
      type === PERIODS.allTime
        ? (
            await this.userService.users({
              orderBy: {
                createdAt: 'asc',
              },
              take: 1,
            })
          )[0].createdAt
        : type === PERIODS.range
        ? moment(startDate).startOf('day').toDate()
        : currentDate;
    const lteValue =
      type === PERIODS.range
        ? moment(endDate).endOf('day').toDate()
        : undefined;
    const users = await this.userService.users({
      where: {
        createdAt: {
          gte: gteValue,
          lte: lteValue,
        },
      },
    });

    const response = createObjForAreaChart(
      users.map((user) => user.createdAt),
      type,
      gteValue,
      lteValue,
    );

    return response;
  }
}
