import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { PERIODS } from 'src/util/enums';
import { User } from 'stream-chat';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionService: SessionService) {}

  @Post('/')
  @ApiTags('session')
  @UseGuards(JwtAuthGuard)
  async createSession(@PrismaUser() user: User) {
    if (!user) {
      this.logger.error("You're not allowed to create session!");
      throw new BadRequestException("You're not allowed to create session!");
    }

    return this.sessionService.createSession({
      user: {
        connect: {
          id: user.id,
        },
      },
    });
  }

  @Get('/')
  @ApiTags('session')
  @UseGuards(JwtAuthGuard)
  async getSessionDeails(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
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
