import { forwardRef, Module } from '@nestjs/common';
import { CommentModule } from 'src/comment/comment.module';
import { CommentService } from 'src/comment/comment.service';
import { FfmpegModule } from 'src/ffmpeg/ffmpeg.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { PostCommentsController } from './post.comments.controller';
import { PostController } from './post.controller';
import { PostFeedController } from './post.feed.controller';
import { PostFeedService } from './post.feed.service';
import { PostLikeController } from './post.like.controller';
import { PostService } from './post.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule),
    StorageModule,
    CommentModule,
    NotificationModule,
    FfmpegModule,
  ],
  controllers: [PostFeedController, PostCommentsController, PostLikeController, PostController],
  providers: [PostService, PostFeedService],
  exports: [PostService],
})
export class PostModule {}
