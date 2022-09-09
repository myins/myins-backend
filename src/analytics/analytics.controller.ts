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
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('analyticTypes') analyticTypes: AnalyticsType[],
    @PrismaUser() user: User,
  ) {
    if (!user) {
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
      (!Date.parse(startDate.toString()) || !Date.parse(endDate.toString()))
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
}
