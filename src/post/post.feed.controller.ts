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
import { PostFeedService } from './post.feed.service';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostFeedController {
  private readonly logger = new Logger(PostFeedController.name);

  constructor(private readonly postFeedService: PostFeedService) {}

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts')
  async getFeed(
    @PrismaUser('id') userID: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
    @Query('onlyMine') onlyMine: boolean,
  ) {
    if (take < 0 || take > 20) {
      this.logger.error('Take must be between 0 and 20!');
      throw new BadRequestException('Take must be between 0 and 20!');
    }
    if (skip < 0 || skip > 1000) {
      this.logger.error('Skip must be between 0 and 1000!');
      throw new BadRequestException('Skip must be between 0 and 1000!');
    }
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(`Getting posts feed for user ${userID}`);
    return this.postFeedService.getFeed(skip, take, userID, onlyMine);
  }
}
