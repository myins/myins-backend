import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev

@Module({
  imports: [
    TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }),
    PrismaModule,
  ],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
