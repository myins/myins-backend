import { Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { NotificationModule } from 'src/notification/notification.module';
import { SmsModule } from 'src/sms/sms.module';
import { UserModule } from 'src/user/user.module';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';

@Module({
  imports: [UserModule, SmsModule, NotificationModule, InsModule],
  controllers: [InviteController],
  providers: [InviteService],
})
export class InviteModule {}
