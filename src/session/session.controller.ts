import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PERIODS } from 'src/util/enums';
import { User } from 'stream-chat';
import { CreateSessionAPI } from './session-api.entity';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionService: SessionService) {}

  @Post('/')
  @ApiTags('session')
  async createSession(@Body() data: CreateSessionAPI) {
    const { userID } = data;
    const dataSession: Prisma.SessionCreateInput = {};
    if (userID) {
      dataSession.user = {
        connect: {
          id: userID,
        },
      };
    }
    return this.sessionService.createSession(dataSession);
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
    if (!user) {
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
      (!Date.parse(startDate.toString()) || !Date.parse(endDate.toString()))
    ) {
      this.logger.error('Invalid range values!');
      throw new BadRequestException('Invalid range values!');
    }

    return this.sessionService.getSessionDetails(type, startDate, endDate);
  }
}
