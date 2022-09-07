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
    if (!user) {
      this.logger.error("You're not allowed to get total users count!");
      throw new BadRequestException(
        "You're not allowed to get total users count!",
      );
    }

    return this.userService.countUsers({});
  }

  @Get('/new-accounts')
  @ApiTags('users-reporting')
  @UseGuards(JwtAuthGuard)
  async getNewAccounts(
    @Query('type') type: number,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @PrismaUser() user: User,
  ) {
    if (!user) {
      this.logger.error("You're not allowed to get total users count!");
      throw new BadRequestException(
        "You're not allowed to get total users count!",
      );
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

    return this.userReportingService.getNewAccounts(type, startDate, endDate);
  }
}