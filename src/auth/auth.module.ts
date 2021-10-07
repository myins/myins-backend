import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { SmsModule } from 'src/sms/sms.module';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [UserModule, SjwtModule, SmsModule, ChatModule],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
