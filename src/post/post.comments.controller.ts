import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CommentService } from 'src/comment/comment.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCommentsController {
  private readonly logger = new Logger(PostCommentsController.name);

  constructor(private readonly commentService: CommentService) {}

  @Get(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async getPostComments(
    @Param('id') id: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Get comments for post ${id} by user ${userID}`);
    return this.commentService.commentsForPost(id, skip, take, userID);
  }
}
