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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import { PERIODS } from 'src/util/enums';
import { isAdmin } from 'src/util/checks';
import { UserReportingService } from './user.reporting.service';

@Controller('user/reporting')
@UseInterceptors(NotFoundInterceptor)
export class UserReportingController {
  private readonly logger = new Logger(UserReportingController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userReportingService: UserReportingService,
  ) {}

  @Get('/all-time')
  @ApiTags('users-reporting')
  @UseGuards(JwtAuthGuard)
  async getAllTimeCountUsers(@PrismaUser() user: User) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    return this.userService.countUsers({
      where: {
        isDeleted: false,
      },
    });
  }

  @Get('/new-accounts')
  @ApiTags('users-reporting')
  @UseGuards(JwtAuthGuard)
  async getNewAccounts(
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

    return this.userReportingService.getNewAccounts(type, startDate, endDate);
  }
}
