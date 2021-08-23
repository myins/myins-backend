import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsModule } from 'src/sms/sms.module';
import { UserModule } from 'src/user/user.module';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';

@Module({
  imports: [UserModule, PrismaModule, SmsModule],
  controllers: [InviteController],
  providers: [InviteService]
})
export class InviteModule {}
