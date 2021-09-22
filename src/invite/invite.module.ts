import { Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { InsModule } from 'src/ins/ins.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsModule } from 'src/sms/sms.module';
import { UserModule } from 'src/user/user.module';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';

@Module({
  imports: [UserModule, PrismaModule, SmsModule, ChatModule, InsModule],
  controllers: [InviteController],
  providers: [InviteService],
})
export class InviteModule {}
