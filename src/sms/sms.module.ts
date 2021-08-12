import { Module } from '@nestjs/common';
import { TwilioModule } from 'nestjs-twilio';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev

// console.log("Got envs:")
// console.log(process.env)

@Module({
  imports: [TwilioModule.forRoot({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }), PrismaModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService]
})
export class SmsModule { }
