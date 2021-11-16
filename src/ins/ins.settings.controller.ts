import {
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UserService } from 'src/user/user.service';
import { MuteINSAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';

@Controller('ins')
export class InsSettingsController {
  private readonly logger = new Logger(InsSettingsController.name);

  constructor(
    private readonly insAdminService: InsAdminService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Patch('/:id/mute')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async toogleMute(
    @PrismaUser('id') userId: string,
    @Param('id') insId: string,
    @Body() data: MuteINSAPI,
  ) {
    this.logger.log(
      `Updating connection between user ${userId} and ins ${insId}. Set isMute to ${data.isMute}`,
    );
    await this.userConnectionService.update({
      where: {
        userId_insId: {
          insId: insId,
          userId: userId,
        },
      },
      data: {
        isMute: data.isMute,
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
  async leaveINS(@PrismaUser('id') userId: string, @Param('id') insId: string) {
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
      this.logger.log(
        `User ${userId} is not an admin for ins ${insId}. Removing from ins`,
      );
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
