import {
  BadRequestException,
  Injectable,
  Logger,
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
import { ChangePasswordAPI, CodePhoneAPI } from './auth-api.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: SjwtService,
    private readonly smsService: SmsService, //@InjectTwilio() private readonly twilioClient: TwilioClient
    private readonly chatService: ChatService,
  ) {}

  async resendConfirmation(phone: string, newPhone?: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (!user) {
      this.logger.error(`Could not find user with phone ${phone}!`);
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberVerified && !newPhone) {
      this.logger.error(`Phone ${phone} already verified!`);
      throw new BadRequestException('Phone already verified!');
    }

    this.logger.log('Sending verification code');
    return this.smsService.sendVerificationCode(user, newPhone);
  }

  async resetPassword(phone: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (!user) {
      this.logger.error(`Could not find user with phone ${phone}!`);
      throw new BadRequestException('Could not find user with that phone!');
    }

    this.logger.log('Sending forgot password code');
    return this.smsService.sendForgotPasswordCode(user);
  }

  async changePassword(user: User, data: ChangePasswordAPI) {
    const userDB = await this.usersService.user({
      phoneNumber: user.phoneNumber,
    });
    if (!userDB) {
      this.logger.error(`Could not find user with phone ${user.phoneNumber}!`);
      throw new BadRequestException('Could not find user with that phone!');
    }

    this.logger.log('Sending forgot password code');
    return this.smsService.sendForgotPasswordCode(user);
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
    if (!user) {
      this.logger.error(`Could not find user with phone ${phone}!`);
      throw new BadRequestException('Could not find user with that phone!');
    }

    this.logger.log('Decrypting reset token');
    const decrypted = await this.jwtService.decrypt(resetToken);
    if (typeof decrypted == 'string') {
      this.logger.error('Decrypted token is a string!');
      throw new BadRequestException(
        'An error occured, please try again later!',
      );
    }
    if (decrypted?.sub !== phone || decrypted?.phone !== phone) {
      this.logger.error('Invalid reset token!');
      throw new BadRequestException('Nice try!');
    }
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltOrRounds);

    this.logger.log(`Updating user ${user.id}. Changing password`);
    return this.usersService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  async verifyUser(data: CodePhoneAPI) {
    const { phone, code, newPhone } = data;
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (!user) {
      this.logger.error(`Could not find user with phone ${phone}!`);
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberVerified && !newPhone) {
      this.logger.error(`Phone ${phone} already verified!`);
      throw new BadRequestException('Phone already verified!');
    }

    this.logger.log('Checking code');
    const res = await this.checkIfCodeCorrect(newPhone ?? phone, code);
    if (!res) {
      this.logger.error(`Invalid code ${code} for phone ${phone}!`);
      throw new BadRequestException('Invalid code!');
    }

    this.logger.log(
      `Updating user ${user.id}. Setting phone verification to true`,
    );
    return this.usersService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        phoneNumber: newPhone ?? phone,
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

    if (!user) {
      // Invalid user, just throw unauthorized
      this.logger.error(`Could not find user with phone ${phone}!`);
      throw new UnauthorizedException('Invalid phone / password!');
    }

    const isMatch = await bcrypt.compare(pass, user.password);

    if (user && isMatch) {
      return user;
    }
    this.logger.error(`Invalid password for user with phone ${phone}!`);
    throw new UnauthorizedException('Invalid phone / password!');
  }

  async login(user: User) {
    this.logger.log(`Generating token for user ${user.id}`);
    const authTokens = await this.jwtService.generateNewAuthTokens(
      user.phoneNumber,
      user.id,
    );

    this.logger.log(`Getting profile for user ${user.id}`);
    const userProfile = await this.usersService.getUserProfile(user.id);
    const addedTogether = { ...userProfile, ...authTokens };

    this.logger.log('Sending verification code');
    this.smsService.sendVerificationCode(user);

    this.logger.log(`User logged ${addedTogether.id}`);
    return addedTogether;
  }

  async refreshToken(userID: string, refreshToken: string) {
    const user = await this.usersService.user({
      id: userID,
    });
    if (!user) {
      this.logger.error(`Could not find user ${userID}!`);
      throw new NotFoundException('Could not find user!');
    }

    if (user.refreshToken != refreshToken) {
      this.logger.error('Invalid refresh token!');
      throw new UnauthorizedException('Invalid refresh token!');
    }

    this.logger.log(`Creating stream user if not exists for user ${user.id}`);
    await this.chatService.createOrUpdateStreamUsers([user]);

    this.logger.log(`Generating token for user ${user.id}`);
    return this.jwtService.generateNewAuthTokens(user.phoneNumber, user.id);
  }

  async logout(user: User) {
    return this.usersService.logoutUser(user.id);
  }
}
