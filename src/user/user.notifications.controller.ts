import { User } from '.prisma/client';
import {
  Body,
  Controller,
  Logger,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import {
  EnableDisableNotificationAPI,
  SetLastNotificationAPI,
} from './user-api.entity';

@Controller('user')
@UseInterceptors(NotFoundInterceptor)
export class UserNotificationsController {
  private readonly logger = new Logger(UserNotificationsController.name);

  constructor(private readonly userService: UserService) {}

  @Patch('setLastNotification')
  @ApiTags('users-notifications')
  @UseGuards(JwtAuthGuard)
  async setLastNotification(
    @Body() data: SetLastNotificationAPI,
    @PrismaUser('id') userID: string,
  ) {
    await this.userService.setLastReadNotificationID(userID, data.notifID);

    this.logger.log('Last notification ID successfully set');
    return {
      message: 'Last notification ID successfully set',
    };
  }

  @Patch('enable-notification-source')
  @ApiTags('users-notifications')
  @UseGuards(JwtAuthGuard)
  async enableNotificationSource(
    @Body() data: EnableDisableNotificationAPI,
    @PrismaUser() user: User,
  ) {
    await this.userService.changeDisabledNotifications(user, data, false);

    this.logger.log('Successfully enabled notification source');
    return {
      message: 'Successfully enabled notification source!',
    };
  }

  @Patch('disable-notification-source')
  @ApiTags('users-notifications')
  @UseGuards(JwtAuthGuard)
  async disableNotificationSource(
    @Body() data: EnableDisableNotificationAPI,
    @PrismaUser() user: User,
  ) {
    await this.userService.changeDisabledNotifications(user, data, true);

    this.logger.log('Successfully disabled notification source');
    return {
      message: 'Successfully disabled notification source!',
    };
  }
}
