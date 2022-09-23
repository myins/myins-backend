import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PERIODS } from 'src/util/enums';
import { isAdmin } from 'src/util/checks';
import { CreateSessionAPI } from './session-api.entity';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionService: SessionService) {}

  @Post('/')
  @ApiTags('session')
  async createSession(@Body() data: CreateSessionAPI) {
    if (data.userID) {
      return this.sessionService.createSession({
        user: {
          connect: {
            id: data.userID,
          },
        },
      });
    }
    return this.sessionService.createSession({});
  }

  @Put(':id')
  @ApiTags('session')
  @UseGuards(JwtAuthGuard)
  async updateSession(
    @PrismaUser('id') userID: string,
    @Param('id') sessionID: string,
  ) {
    return this.sessionService.updateSession(sessionID, {
      user: {
        connect: {
          id: userID,
        },
      },
    });
  }

  @Get('/')
  @ApiTags('session')
  @UseGuards(JwtAuthGuard)
  async getSessionDeails(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @PrismaUser() user: User,
  ) {
    if (!user || !isAdmin(user.phoneNumber)) {
      this.logger.error("You're not allowed to get session details!");
      throw new BadRequestException(
        "You're not allowed to get session details!",
      );
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

    return this.sessionService.getSessionDetails(type, startDate, endDate);
  }

  @Get('avg-weekly-active-user')
  @UseGuards(JwtAuthGuard)
  @ApiTags('session')
  async getAvgWeeklyActiveUser(
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

    return this.sessionService.getAvgWeeklyActiveUser(type, startDate, endDate);
  }
}
