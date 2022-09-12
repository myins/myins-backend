import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PERIODS } from 'src/util/enums';
import { createObjForAreaChart, getDatesByType } from 'src/util/reporting';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async createSession(data: Prisma.SessionCreateInput) {
    return this.prisma.session.create({
      data: data,
    });
  }

  async sessions(params: Prisma.SessionFindManyArgs) {
    return this.prisma.session.findMany(params);
  }

  async getSessionDetails(type: number, startDate: Date, endDate: Date) {
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
      ...new Set(sessions.map((session) => session.userId)),
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
}
