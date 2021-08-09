import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CommentService } from 'src/comment/comment.service';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';

@Controller('post')
@UseInterceptors(NotFoundInterceptor)
export class PostCommentsController {
  constructor(private readonly commentService: CommentService) {}

  @Get(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiTags('comments')
  async getPostComments(
    @Param('id') id: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @UserID() userID: string,
  ) {
    return this.commentService.commentsForPost(id, skip, take, userID);
  }
}
