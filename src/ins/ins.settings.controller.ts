import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UserService } from 'src/user/user.service';
import { LeaveINSAPI, MuteINSAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsService } from './ins.service';

@Controller('ins')
export class InsSettingsController {
  private readonly logger = new Logger(InsSettingsController.name);

  constructor(
    private readonly insService: InsService,
    private readonly insAdminService: InsAdminService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Cron('*/10 * * * *')
  async setUnmutedIns() {
    this.logger.log('[Cron] Setting unmute for inses that is no more muted');
    const res = await this.userConnectionService.updateMany({
      where: {
        muteUntil: {
          lt: new Date(),
        },
      },
      data: {
        muteUntil: null,
      },
    });
    this.logger.log(
      `[Cron] Successfully set unmute for ${res.count} muted inses!`,
    );
  }

  @Patch('/:id/mute')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async toggleMute(
    @PrismaUser('id') userId: string,
    @Param('id') insId: string,
    @Body() data: MuteINSAPI,
  ) {
    const connection = await this.userConnectionService.getNotPendingConnection(
      {
        userId_insId: {
          insId: insId,
          userId: userId,
        },
      },
    );
    if (!connection) {
      this.logger.error("You're not allowed to mute this ins!");
      throw new BadRequestException("You're not allowed to mute this ins!");
    }

    this.logger.log(
      `Updating connection between user ${userId} and ins ${insId}. Set muteUntil`,
    );
    const milliseconds = data.minutes * 60 * 1000;
    const muteUntilValue: Date | null = data.isMute
      ? data.minutes > 0
        ? new Date(new Date().getTime() + milliseconds)
        : new Date(new Date().setFullYear(3000))
      : null;
    await this.userConnectionService.update({
      where: {
        userId_insId: {
          insId: insId,
          userId: userId,
        },
      },
      data: {
        muteUntil: muteUntilValue,
      },
    });

    this.logger.log('Successfully set mute');
    return {
      message: 'Successfully set mute',
    };
  }

  @Delete('/:id/leave')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async leaveINS(
    @PrismaUser('id') userId: string,
    @Param('id') insId: string,
    @Body() data: LeaveINSAPI,
  ) {
    const user = await this.userService.user({
      id: userId,
    });
    if (!user) {
      this.logger.error(`Could not find user ${userId}!`);
      throw new NotFoundException('Could not find this user!');
    }

    this.logger.log(`Checking if user ${userId} is admin for ins ${insId}`);
    const isAdmin = await this.insAdminService.isAdmin(userId, insId);
    let message = 'User cannot be deleted because is admin!';

    if (!isAdmin) {
      if (!data.keepData) {
        this.logger.log(
          `Cleaning media that belongs to member ${userId} from ins ${insId}`,
        );
        await this.insService.cleanMedia(userId, insId);
      }

      this.logger.log(`Removing member ${userId} from ins ${insId}`);
      await this.userConnectionService.removeMember({
        userId_insId: {
          insId: insId,
          userId: userId,
        },
      });
      message = 'User successfully removed from ins';
      this.logger.log(message);
    }

    return {
      isAdmin: isAdmin,
      message: message,
    };
  }
}
