import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcryptjs';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { SmsService } from 'src/sms/sms.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: SjwtService,
    private smsService: SmsService,
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
    return {
      message: 'Successfully sent confirmation sms!',
    };
  }

  async resetPassword(phone: string) {
    const user = await this.usersService.user({
      phoneNumber: phone,
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    return this.smsService.sendForgotPasswordCode(user);
  }

  async confirmResetPassword(phone: string, code: string, newPassword: string) {
    const user = await this.usersService.user({
      phoneNumber: phone
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberCode != code) {
      throw new BadRequestException('Invalid code!');
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
      phoneNumber: phone
    });
    if (user == null) {
      throw new BadRequestException('Could not find user with that phone!');
    }
    if (user.phoneNumberCode != code) {
      throw new BadRequestException('Invalid code!');
    }
    await this.usersService.updateUser({
      where: {
        id: user.id
      },
      data: {
        phoneNumberCode: null,
        phoneNumberVerified: true
      }
    })
    return {
      message: "User verified!"
    }
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
    const userProfile = await this.usersService.getUserProfile(
      user.id,
    );
    const addedTogether = { ...userProfile, ...authTokens };

    this.smsService.sendVerificationCode(user);

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

  async logout(user: string) {
    const userModel = await this.usersService.user({ id: user });
    if (userModel == null) {
      throw new NotFoundException();
    }
    return this.usersService.logoutUser(userModel);
  }
}
