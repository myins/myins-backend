import { User } from '.prisma/client';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notifService: NotificationService) {}

  @Get('feed')
  @ApiTags('notification')
  @UseGuards(JwtAuthGuard)
  async getFeed(
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    if (take > 20) {
      this.logger.error('Take param bigger than 20!');
      throw new BadRequestException("Don't get greedy!");
    }
    this.logger.log(`Getting notifications feed for user ${userID}`);
    return this.notifService.getFeed(userID, skip, take);
  }

  @Get('count-unread')
  @ApiTags('notification')
  @UseGuards(JwtAuthGuard)
  async countUnreadNotifications(@PrismaUser() user: User) {
    this.logger.log(`Counting unread notificaions for user ${user.id}`);
    return {
      countUnread: await this.notifService.countUnreadNotifications(user),
    };
  }
}
