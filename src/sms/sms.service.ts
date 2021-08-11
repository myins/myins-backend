import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';
import { PrismaService } from 'src/prisma/prisma.service';

const randomArray = [
    "Taking pictures of all the people that stop by",
    "What about all the illegal drugs you do in your garage?",
    "Oh there's no illegal drugs in my garage",
    "oWoWoWoWoW",
    "Hello there darling",
    "There's no illegal drugs on my property",
    "Yes there are"]

@Injectable()
export class SmsService {
    constructor(@InjectTwilio() private readonly client: TwilioClient) { }

    async sendVerificationCode(user: { phoneNumberVerified: boolean, id: string, phoneNumber: string }) {
        if (user.phoneNumberVerified) {
            return
        }

        const toRet = await this.sendSMS(user.phoneNumber)
        console.log("Got answer:")
        console.log(toRet)
        return toRet
    }


    async sendSMS(target: string) {
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
        await this.sendSMS(user.phoneNumber)
    }

}
