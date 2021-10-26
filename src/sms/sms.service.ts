import { Injectable, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';
import { isTestNumber } from 'src/util/test-numbers';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(@InjectTwilio() private readonly client: TwilioClient) {}

  async sendVerificationCode(
    user: {
      phoneNumberVerified: boolean;
      id: string;
      phoneNumber: string;
    },
    newPhoneNumber?: string,
  ) {
    if (user.phoneNumberVerified && !newPhoneNumber) {
      return;
    }

    return this.sendVerificationSMS(newPhoneNumber ?? user.phoneNumber);
  }

  async sendSMS(target: string, message: string) {
    return this.client.messages.create({
      messagingServiceSid: process.env.TWILIO_SMS_SID,
      body: message,
      to: target,
    });
  }

  async sendVerificationSMS(target: string) {
    if (isTestNumber(target)) {
      return;
    }
    try {
      return this.client.verify
        .services(process.env.TWILIO_SERVICE_SID ?? '')
        .verifications.create({ to: target, channel: 'sms' });
    } catch (e) {
      this.logger.error('Error sending sms!');
      this.logger.error(e);
      return e;
    }
  }

  async sendForgotPasswordCode(user: User) {
    return this.sendVerificationSMS(user.phoneNumber);
  }
}
