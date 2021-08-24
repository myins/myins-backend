import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';
import { isTestNumber } from 'src/util/test-numbers';

@Injectable()
export class SmsService {
    constructor(@InjectTwilio() private readonly client: TwilioClient) { }

    async sendVerificationCode(user: { phoneNumberVerified: boolean, id: string, phoneNumber: string }) {
        if (user.phoneNumberVerified) {
            return
        }

        const toRet = await this.sendVerificationSMS(user.phoneNumber)

        return toRet
    }

    async sendSMS(target: string, message: string) {
        return this.client.messages
            .create({ messagingServiceSid: process.env.TWILIO_SMS_SID, body: message, to: target })
    }


    async sendVerificationSMS(target: string) {
        if (isTestNumber(target)) {
            return
        }
        try {
            const toRet = await this.client.verify.services(process.env.TWILIO_SERVICE_SID ?? "")
                .verifications
                .create({ to: target, channel: 'sms' })
            return toRet
        } catch (e) {
            return e;
        }
    }

    async sendForgotPasswordCode(user: User) {
        await this.sendVerificationSMS(user.phoneNumber)
    }

}
