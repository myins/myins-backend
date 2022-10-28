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
import { PostReportingService } from './post.reporting.service';
import { isAdmin } from 'src/util/checks';
import { User } from '@prisma/client';
import { calculateMostUsedWorlds, getDatesByType } from 'src/util/reporting';
import { PostService } from './post.service';
import { CommentService } from 'src/comment/comment.service';

@Controller('post/reporting')
@UseInterceptors(NotFoundInterceptor)
export class PostReportingController {
  private readonly logger = new Logger(PostReportingController.name);

  constructor(
    private readonly postReportingService: PostReportingService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
  ) {}

  @Get('total')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts-reporting')
  async getTotalPosts(
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

    return this.postReportingService.getTotalPosts(type, startDate, endDate);
  }

  @Get('percent-display-of-all-posts')
  @UseGuards(JwtAuthGuard)
  @ApiTags('posts-reporting')
  async getPercentDisplayOfAllPosts(
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

    return this.postReportingService.getPercentDisplayOfAllPosts(
      type,
      startDate,
      endDate,
    );
  }

  @Get('/most-used-words')
  @ApiTags('posts-reporting')
  @UseGuards(JwtAuthGuard)
  async getMostUsedWords(
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

    const dates = getDatesByType(type, startDate, endDate);
    if (type === PERIODS.allTime) {
      const oldestPost = (
        await this.postService.posts({
          where: {
            pending: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
      const oldestComment = (
        await this.commentService.comments({
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        })
      )[0]?.createdAt;
      dates.gteValue = new Date(
        Math.min.apply(null, [oldestPost.getTime(), oldestComment.getTime()]),
      );
    }

    if (dates.gteValue) {
      const createdAtQuery = {
        gte: dates.gteValue,
        lte: dates.lteValue,
      };
      const posts = await this.postService.posts({
        where: {
          pending: false,
          createdAt: createdAtQuery,
        },
      });
      const postsContent = posts
        .map((post) => post.content)
        .filter((content) => content !== null);

      const comments = await this.commentService.comments({
        where: {
          createdAt: createdAtQuery,
        },
      });
      const commentsContent = comments
        .map((comment) => comment.content)
        .filter((content) => content !== null);

      const contents = postsContent.concat(commentsContent);

      return calculateMostUsedWorlds(<string[]>contents);
    }

    return 0;
  }
}
