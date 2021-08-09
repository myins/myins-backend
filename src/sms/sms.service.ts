import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class SmsService {

    async sendVerificationCode(user: User) {
        if (user.phoneNumberVerified) {
            return
        }
        throw "Not done yet"
    }

    async sendForgotPasswordCode(user: User) {
        throw "Not done yet!"
    }

}
