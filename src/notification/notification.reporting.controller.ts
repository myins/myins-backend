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
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PERIODS } from 'src/util/enums';
import { User } from 'stream-chat';
import { NotificationService } from './notification.service';
import { getDatesByType } from 'src/util/reporting';
import { NotificationSource } from '@prisma/client';

@Controller('notification/reporting')
@UseInterceptors(NotFoundInterceptor)
export class NotificationReportingController {
  private readonly logger = new Logger(NotificationReportingController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Get('')
  @UseGuards(JwtAuthGuard)
  @ApiTags('notifications-reporting')
  async getNotifications(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @PrismaUser() user: User,
  ) {
    if (!user) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    if (Number.isNaN(type)) {
      this.logger.error('Invalid type value!');
      throw new BadRequestException('Invalid type value!');
    }

    if (
      type === PERIODS.range &&
      (!Date.parse(startDate.toString()) || !Date.parse(endDate.toString()))
    ) {
      this.logger.error('Invalid range values!');
      throw new BadRequestException('Invalid range values!');
    }

    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      dates.gteValue = (
        await this.notificationService.getNotifications({
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

      const notificationsGroupByCreatedFrom =
        await this.notificationService.groupBy(['source'], {
          createdAt: createdAtQuery,
        });

      const response = notificationsGroupByCreatedFrom.map(
        (notificationGroupBy) => {
          return {
            type: notificationGroupBy.source,
            value: notificationGroupBy._count?._all ?? 0,
          };
        },
      );
      Object.keys(NotificationSource).map((source) => {
        if (!response.find((notif) => notif.type === source)) {
          response.push({
            type: <NotificationSource>source,
            value: 0,
          });
        }
      });

      const responseSort = response.sort((a, b) => {
        return a.type.localeCompare(b.type);
      });

      return responseSort;
    }

    return [
      {
        date: '',
        value: 0,
      },
    ];
  }
}
