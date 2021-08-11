import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomCode } from 'src/util/random';

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
    constructor(private readonly prismaService: PrismaService, @InjectTwilio() private readonly client: TwilioClient) { }

    async sendVerificationCode(user: User) {
        if (user.phoneNumberVerified) {
            return
        }
        const newCode = randomCode()
        await this.prismaService.user.update({
            where: { id: user.id }, data: {
                phoneNumberCode: newCode
            }
        })

        const randomText = randomArray[Math.floor(Math.random() * randomArray.length)];
        await this.sendSMS(user.phoneNumber, `${newCode} ${randomText}`)
    }


    async sendSMS(target: string, body: string) {
        try {
            return await this.client.messages.create({
                body: body,
                to: target,
            });
        } catch (e) {
            return e;
        }
    }

    async sendForgotPasswordCode(user: User) {
        const newCode = randomCode()
        await this.prismaService.user.update({
            where: { id: user.id }, data: {
                phoneNumberCode: newCode
            }
        })
        const randomText = randomArray[Math.floor(Math.random() * randomArray.length)];
        await this.sendSMS(user.phoneNumber, `${newCode} ${randomText}`)

    }

}
