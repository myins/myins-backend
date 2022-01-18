import { forwardRef, Module } from '@nestjs/common';
import { CommentModule } from 'src/comment/comment.module';
import { MediaModule } from 'src/media/media.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserModule } from 'src/user/user.module';
import { InsAdminController } from './ins.admin.controller';
import { InsAdminService } from './ins.admin.service';
import { InsCleanMediaService } from './ins.clean.media.service';
import { InsController } from './ins.controller';
import { InsPinController } from './ins.pin.controller';
import { InsService } from './ins.service';
import { InsSettingsController } from './ins.settings.controller';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    CommentModule,
    forwardRef(() => UserModule),
    PostModule,
    NotificationModule,
    MediaModule,
  ],
  controllers: [
    InsController,
    InsAdminController,
    InsPinController,
    InsSettingsController,
  ],
  providers: [InsService, InsAdminService, InsCleanMediaService],
  exports: [InsService],
})
export class InsModule {}
