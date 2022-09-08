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
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PERIODS } from 'src/util/enums';
import { User } from 'stream-chat';
import { PostReportingService } from './post.reporting.service';

@Controller('post/reporting')
@UseInterceptors(NotFoundInterceptor)
export class PostReportingController {
  private readonly logger = new Logger(PostReportingController.name);

  constructor(private readonly postReportingService: PostReportingService) {}

  @Get('total')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts-reporting')
  async getTotalPosts(
    @Query('type') type: PERIODS,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @PrismaUser() user: User,
  ) {
    if (!user) {
      this.logger.error("You're not allowed to get reports!");
      throw new BadRequestException("You're not allowed to get reports!");
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

    return this.postReportingService.getTotalPosts(type, startDate, endDate);
  }
}
