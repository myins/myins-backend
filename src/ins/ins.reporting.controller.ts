import { User } from '.prisma/client';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { INS, UserInsConnection } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import { isAdmin } from 'src/util/checks';
import { PERIODS } from 'src/util/enums';
import { calculateMostUsedWorlds, getDatesByType } from 'src/util/reporting';
import { InsService } from './ins.service';

@Controller('ins/reporting')
@UseInterceptors(NotFoundInterceptor)
export class InsReportingController {
  private readonly logger = new Logger(InsReportingController.name);

  constructor(
    private readonly insService: InsService,
    private readonly userService: UserService,
  ) {}

  @Get('/avg-groups-per-user')
  @ApiTags('ins-reporting')
  @UseGuards(JwtAuthGuard)
  async getAvgGroupsPerUser(@PrismaUser() user: User) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    const users = await this.userService.users({
      include: {
        inses: true,
      },
    });

    let totalCountGroups = 0;
    const castedUsers = <
      (User & {
        inses: UserInsConnection[];
      })[]
    >users;
    castedUsers.forEach((user) => {
      totalCountGroups += user.inses.length;
    });

    const countUsers = await this.userService.countUsers({});

    return (totalCountGroups / countUsers).toFixed(2);
  }

  @Get('/avg-group-members-per-group')
  @ApiTags('ins-reporting')
  @UseGuards(JwtAuthGuard)
  async getAvgGroupMembersPerGroup(@PrismaUser() user: User) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    const inses = await this.insService.inses({
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    let totalCountGroupMembers = 0;
    const castedInses = <
      (INS & {
        _count: {
          members: number;
        };
      })[]
    >inses;
    castedInses.forEach((ins) => {
      totalCountGroupMembers += ins._count.members;
    });

    const countInses = await this.insService.countINS({});

    return (totalCountGroupMembers / countInses).toFixed(2);
  }

  @Get('/groups-with-users-count')
  @ApiTags('ins-reporting')
  @UseGuards(JwtAuthGuard)
  async getGroupsWithUsersCount(@PrismaUser() user: User) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    const inses = await this.insService.inses({
      include: {
        members: true,
      },
    });

    const countGroups: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const castedInses = <
      (INS & {
        members: UserInsConnection[];
      })[]
    >inses;
    castedInses.forEach((ins) => {
      let index = ins.members.length;
      if (index > 10) {
        index = 10;
      }
      countGroups[index - 1]++;
    });

    const countGroupsRes = countGroups.map((groupCount, index) => {
      return {
        users: index < 9 ? `${index + 1} Us.` : '10+',
        Groups: groupCount,
      };
    });

    return countGroupsRes;
  }

  @Get('/users-with-groups-count')
  @ApiTags('ins-reporting')
  @UseGuards(JwtAuthGuard)
  async getUsersWithGroupsCount(@PrismaUser() user: User) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    const users = await this.userService.users({
      include: {
        inses: true,
      },
    });

    const countUsers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const castedUsers = <
      (User & {
        inses: UserInsConnection[];
      })[]
    >users;
    castedUsers.forEach((user) => {
      let index = user.inses.length;
      if (index > 10) {
        index = 10;
      }
      countUsers[index - 1]++;
    });

    const countUsersRes = countUsers.map((userCount, index) => {
      return {
        groups: index < 9 ? `${index + 1} Gr.` : '10+',
        Users: userCount,
      };
    });

    return countUsersRes;
  }

  @Get('/most-used-words')
  @ApiTags('ins-reporting')
  @UseGuards(JwtAuthGuard)
  async getMostUsedWords(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @PrismaUser() user: User,
  ) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    if (Number.isNaN(type)) {
      this.logger.error('Invalid type value!');
      throw new BadRequestException('Invalid type value!');
    }

    if (
      type === PERIODS.range &&
      (!startDate ||
        !endDate ||
        !Date.parse(startDate.toString()) ||
        !Date.parse(endDate.toString()))
    ) {
      this.logger.error('Invalid range values!');
      throw new BadRequestException('Invalid range values!');
    }

    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.insService.inses({
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
      const inses = await this.insService.inses({
        where: {
          createdAt: createdAtQuery,
        },
      });
      const insesName = inses.map((ins) => ins.name);

      return calculateMostUsedWorlds(insesName);
    }

    return 0;
  }
}
