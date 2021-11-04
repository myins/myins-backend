import { User } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Patch,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import { EnableDisableByometryAPI } from './user-api.entity';
import { UserConnectionService } from './user.connection.service';

@Controller('user/biometrics')
@UseInterceptors(NotFoundInterceptor)
export class UserBiometricsController {
  private readonly logger = new Logger(UserBiometricsController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Patch('enable')
  @ApiTags('users-notifications')
  @UseGuards(JwtAuthGuard)
  async enableBiometryINS(
    @Body() data: EnableDisableByometryAPI,
    @PrismaUser() user: User,
  ) {
    const { insID, all } = data;

    if (!all && !insID) {
      this.logger.error(
        "At least one param from 'all' and 'insID' should be valid!",
      );
      throw new BadRequestException(
        "At least one param from 'all' and 'insID' should be valid!",
      );
    }

    if (insID) {
      const connection =
        await this.userConnectionService.getNotPendingConnection({
          userId_insId: {
            insId: insID,
            userId: user.id,
          },
        });
      if (!connection) {
        this.logger.error("You're not allowed to enable this INS!");
        throw new UnauthorizedException(
          "You're not allowed to enable this INS!",
        );
      }
    }

    await this.userService.changeDisabledByometrics(user, data, false);

    this.logger.log('Successfully enabled byometry');
    return {
      message: 'Successfully enabled byometry!',
    };
  }

  @Patch('disable')
  @ApiTags('users-notifications')
  @UseGuards(JwtAuthGuard)
  async disableBiometryINS(
    @Body() data: EnableDisableByometryAPI,
    @PrismaUser() user: User,
  ) {
    const { insID, all } = data;

    if (!all && !insID) {
      this.logger.error(
        "At least one param from 'all' and 'insID' should be valid!",
      );
      throw new BadRequestException(
        "At least one param from 'all' and 'insID' should be valid!",
      );
    }

    if (insID) {
      const connection =
        await this.userConnectionService.getNotPendingConnection({
          userId_insId: {
            insId: insID,
            userId: user.id,
          },
        });
      if (!connection) {
        this.logger.error("You're not allowed to disable this INS!");
        throw new UnauthorizedException(
          "You're not allowed to disable this INS!",
        );
      }
    }

    await this.userService.changeDisabledByometrics(user, data, true);

    this.logger.log('Successfully disabled byometry');
    return {
      message: 'Successfully disabled byometry!',
    };
  }
}
