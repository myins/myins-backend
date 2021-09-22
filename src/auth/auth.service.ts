import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import { ChatService } from 'src/chat/chat.service';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { SmsService } from 'src/sms/sms.service';
import { UserService } from 'src/user/user.service';
import { isTestNumber } from 'src/util/test-numbers';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: SjwtService,
    private smsService: SmsService, //@InjectTwilio() private readonly twilioClient: TwilioClient
    private chatService: ChatService,
  ) {}

  async resendConfirmation(phone: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberVerified) {
      throw new BadRequestException('Phone already verified!');
    }
    await this.smsService.sendVerificationCode(user);
  }

  async resetPassword(phone: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    await this.smsService.sendForgotPasswordCode(user);
  }

  async checkIfCodeCorrect(phone: string, code: string) {
    //const sid = process.env.TWILIO_SERVICE_SID ?? ""
    // const res = await this.twilioClient.verify.v2.services(sid)
    //   .verificationChecks
    //   .create({ to: phone, code: code })
    // This is not working for some inane reason, patch it using fetch for now
    if (isTestNumber(phone)) {
      return code === '1234';
    }

    const details: { [key: string]: string } = {
      Code: code,
      To: phone,
    };

    const formBody = [];
    for (const property in details) {
      const encodedKey = encodeURIComponent(property);
      const encodedValue = encodeURIComponent(details[property]);
      formBody.push(encodedKey + '=' + encodedValue);
    }
    const finalForm = formBody.join('&');

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/VerificationCheck`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: finalForm,
        method: 'POST',
      },
    );
    const resData = await res.json();
    return resData.status === 'approved';
  }

  async confirmResetPassword(
    phone: string,
    resetToken: string,
    newPassword: string,
  ) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    const decrypted = await this.jwtService.decrypt(resetToken);
    if (typeof decrypted == 'string') {
      throw new BadRequestException(
        'An error occured, please try again later!',
      );
    }
    if (decrypted?.sub !== phone || decrypted?.phone !== phone) {
      throw new BadRequestException('Nice try!');
    }
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltOrRounds);

    await this.usersService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  async verifyUser(phone: string, code: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberVerified) {
      throw new BadRequestException('User already verified!');
    }
    const res = await this.checkIfCodeCorrect(phone, code);
    if (!res) {
      throw new BadRequestException('Invalid code!');
    }
    await this.usersService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        phoneNumberVerified: true,
      },
    });
  }

  async phoneExists(phone: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    return {
      exists: user !== null,
    };
  }

  async validateUser(phone: string, pass: string): Promise<User> {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });

    if (user == null) {
      // Invalid user, just throw unauthorized
      throw new UnauthorizedException('Invalid phone / password!');
    }

    const isMatch = await bcrypt.compare(pass, user.password);

    if (user && isMatch) {
      return user;
    }
    throw new UnauthorizedException('Invalid phone / password!');
  }

  async login(user: User) {
    const authTokens = await this.jwtService.generateNewAuthTokens(
      user.phoneNumber,
      user.id,
    );
    const userProfile = await this.usersService.getUserProfile(user.id);
    const addedTogether = { ...userProfile, ...authTokens };

    this.smsService.sendVerificationCode(user);

    this.chatService.createStreamChatUsers([user]);

    return addedTogether;
  }

  async refreshToken(userID: string, refreshToken: string) {
    const user = await this.usersService.user({
      id: userID,
    });
    if (user == null) {
      throw new NotFoundException();
    }

    if (user.refreshToken != refreshToken) {
      throw new UnauthorizedException();
    }

    const res = await this.jwtService.generateNewAuthTokens(
      user.phoneNumber,
      user.id,
    );
    return res;
  }

  async logout(user: User) {
    return this.usersService.logoutUser(user);
  }
}
