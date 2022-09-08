import { User } from '.prisma/client';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';

@Controller('invite/reporting')
@UseInterceptors(NotFoundInterceptor)
export class InviteReportingController {
  private readonly logger = new Logger(InviteReportingController.name);

  @Get('/')
  @ApiTags('invite-reporting')
  @UseGuards(JwtAuthGuard)
  async getInvites(@PrismaUser() user: User) {
    if (!user) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
    }

    return {};
  }
}
