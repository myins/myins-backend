import { forwardRef, Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { PostModule } from 'src/post/post.module';
import { NotificationModule } from 'src/notification/notification.module';
import { CommentLikeService } from './comment.like.service';
import { CommentLikeController } from './comment.like.controller';
import { InsModule } from 'src/ins/ins.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule),
    forwardRef(() => PostModule),
    NotificationModule,
    InsModule,
  ],
  providers: [CommentService, CommentLikeService],
  exports: [CommentService],
  controllers: [CommentLikeController, CommentController],
})
export class CommentModule {}
