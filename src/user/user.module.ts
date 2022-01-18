import { Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { CurrentVersionsModule } from 'src/current-versions/current-versions.module';
import { InsModule } from 'src/ins/ins.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { SmsModule } from 'src/sms/sms.module';
import { StorageModule } from 'src/storage/storage.module';
import { UserBiometricsController } from './user.biometrics.controller';
import { UserConnectionService } from './user.connection.service';
import { UserController } from './user.controller';
import { UserNotificationsController } from './user.notifications.controller';
import { UserPendingController } from './user.pending.controller';
import { UserService } from './user.service';
import { UserVersionsController } from './user.versions.controller';

@Module({
  imports: [
    PrismaModule,
    SjwtModule,
    SmsModule,
    StorageModule,
    CurrentVersionsModule,
    InsModule,
    ChatModule,
    NotificationModule,
  ],
  controllers: [
    UserPendingController,
    UserController,
    UserVersionsController,
    UserNotificationsController,
    UserBiometricsController,
  ],
  providers: [UserService, UserConnectionService],
  exports: [UserService, UserConnectionService],
})
export class UserModule {}
