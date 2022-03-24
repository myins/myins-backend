import { forwardRef, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationPushService } from './notification.push.service';
import { UserModule } from 'src/user/user.module';
import { InsModule } from 'src/ins/ins.module';
import { PostModule } from 'src/post/post.module';
import { CommentModule } from 'src/comment/comment.module';
import { StoryModule } from 'src/story/story.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule),
    forwardRef(() => InsModule),
    forwardRef(() => PostModule),
    forwardRef(() => CommentModule),
    StoryModule,
  ],
  providers: [NotificationPushService, NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationPushService],
})
export class NotificationModule {}
