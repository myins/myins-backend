import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsType, User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PERIODS } from 'src/util/enums';
import { isAdmin } from 'src/util/checks';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('/')
  @ApiTags('analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('analyticTypes') analyticTypes: AnalyticsType[],
    @PrismaUser() user: User,
  ) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get analytics!");
      throw new BadRequestException("You're not allowed to get analytics!");
    }

    if (!analyticTypes?.length) {
      this.logger.error('Invalid analytic types value!');
      throw new BadRequestException('Invalid analytic types value!');
    }

    const analyticsTypeValues = Object.keys(AnalyticsType);
    analyticTypes.forEach((analytic) => {
      if (!analyticsTypeValues.includes(analytic)) {
        this.logger.error('Invalid analytic type value!');
        throw new BadRequestException('Invalid analytic type value!');
      }
    });

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

    return this.analyticsService.getAnalytics(
      type,
      startDate,
      endDate,
      analyticTypes,
    );
  }

  @Get('/avg-time-acc-delete')
  @ApiTags('analytics')
  @UseGuards(JwtAuthGuard)
  async getAvgTimeToAccDelete(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @PrismaUser() user: User,
  ) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get analytics!");
      throw new BadRequestException("You're not allowed to get analytics!");
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

    return this.analyticsService.getAvgTimeToAccDelete(
      type,
      startDate,
      endDate,
    );
  }

  @Get('/downloads-uninstalls')
  @ApiTags('analytics')
  @UseGuards(JwtAuthGuard)
  async getDownloadsAndUninstalls(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @PrismaUser() user: User,
  ) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get analytics!");
      throw new BadRequestException("You're not allowed to get analytics!");
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

    return this.analyticsService.getDownloadsAndUninstalls(
      type,
      startDate,
      endDate,
    );
  }
}
