import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { CommentModule } from 'src/comment/comment.module';
import { FfmpegModule } from 'src/ffmpeg/ffmpeg.module';
import { InsModule } from 'src/ins/ins.module';
import { InteractionModule } from 'src/interaction/interaction.module';
import { MediaModule } from 'src/media/media.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { PostCommentsController } from './post.comments.controller';
import { PostConnectionService } from './post.connection.service';
import { PostController } from './post.controller';
import { PostCreateController } from './post.create.controller';
import { PostFeedController } from './post.feed.controller';
import { PostFeedService } from './post.feed.service';
import { PostLikeController } from './post.like.controller';
import { PostLikeService } from './post.like.service';
import { PostService } from './post.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule),
    StorageModule,
    forwardRef(() => CommentModule),
    NotificationModule,
    FfmpegModule,
    forwardRef(() => InsModule),
    forwardRef(() => ChatModule),
    InteractionModule,
    MediaModule,
  ],
  controllers: [
    PostFeedController,
    PostCommentsController,
    PostLikeController,
    PostController,
    PostCreateController,
  ],
  providers: [
    PostService,
    PostFeedService,
    PostLikeService,
    PostConnectionService,
  ],
  exports: [PostService, PostLikeService, PostConnectionService],
})
export class PostModule {}
