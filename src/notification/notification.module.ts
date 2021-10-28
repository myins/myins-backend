import { forwardRef, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationPushService } from './notification.push.service';
import { UserModule } from 'src/user/user.module';
import { FirebaseAdminModule } from '@aginix/nestjs-firebase-admin';
import { InsModule } from 'src/ins/ins.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UserModule),
    FirebaseAdminModule,
    forwardRef(() => InsModule),
  ],
  providers: [NotificationPushService, NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
