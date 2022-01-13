import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { InsModule } from 'src/ins/ins.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { StoryModule } from 'src/story/story.module';
import { UserModule } from 'src/user/user.module';
import { MediaConnectionsController } from './media.connections.controller';
import { MediaConnectionsService } from './media.connections.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => InsModule),
    forwardRef(() => PostModule),
    forwardRef(() => ChatModule),
    NotificationModule,
    forwardRef(() => UserModule),
    StoryModule,
  ],
  controllers: [MediaController, MediaConnectionsController],
  providers: [MediaService, MediaConnectionsService],
  exports: [MediaService],
})
export class MediaModule {}
