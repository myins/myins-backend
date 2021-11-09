import { forwardRef, Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { CommentModule } from 'src/comment/comment.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { InsAdminController } from './ins.admin.controller';
import { InsAdminService } from './ins.admin.service';
import { InsController } from './ins.controller';
import { InsPinController } from './ins.pin.controller';
import { InsService } from './ins.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => ChatModule),
    CommentModule,
    forwardRef(() => UserModule),
    PostModule,
    NotificationModule,
  ],
  controllers: [InsController, InsAdminController, InsPinController],
  providers: [InsService, InsAdminService],
  exports: [InsService],
})
export class InsModule {}
