import { User } from '.prisma/client';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Cron('0 1 * * *')
  async removeOldINS() {
    this.logger.log('[Cron] Removing all notifications older than a month');
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    const res = await this.notificationService.deleteNotifications({
      createdAt: {
        lt: date,
      },
    });
    this.logger.log(
      `[Cron] Successfully removed ${res.count} old notifications!`,
    );
  }

  @Get('feed')
  @ApiTags('notification')
  @UseGuards(JwtAuthGuard)
  async getFeed(
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }
    if (take > 20) {
      this.logger.error('Take param bigger than 20!');
      throw new BadRequestException("Don't get greedy!");
    }
    this.logger.log(`Getting notifications feed for user ${userID}`);
    return this.notificationService.getFeed(userID, skip, take);
  }

  @Get('count-unread')
  @ApiTags('notification')
  @UseGuards(JwtAuthGuard)
  async countUnreadNotifications(@PrismaUser() user: User) {
    return {
      countUnread: await this.notificationService.countUnreadNotifications(
        user,
      ),
    };
  }
}
