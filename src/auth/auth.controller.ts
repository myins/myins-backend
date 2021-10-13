import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { PrismaUser } from 'src/decorators/user.decorator';
import { SjwtService } from 'src/sjwt/sjwt.service';
import {
  CodePhoneAPI,
  PhoneBodyAPI,
  RefreshTokenBodyAPI,
  ResetPasswordAPI,
} from './auth-api.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategyPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: SjwtService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @ApiTags('auth')
  @Post('login')
  async login(@Request() req: { user: User }) {
    this.logger.log(`Login user ${req.user.id}`);
    return this.authService.login(req.user);
  }

  @Post('refresh-auth')
  @ApiTags('auth')
  @ApiBearerAuth()
  async refreshAuth(@Body() postData: RefreshTokenBodyAPI) {
    this.logger.log(`Refresh token for user ${postData.userID}`);
    return this.authService.refreshToken(
      postData.userID,
      postData.refreshToken,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('logout')
  @ApiTags('auth')
  @ApiBearerAuth()
  async logout(@PrismaUser() user: User) {
    this.logger.log(`Logout user ${user.id}`);
    return this.authService.logout(user);
  }

  @Post('verifyCode')
  @ApiTags('auth')
  async verifyUser(@Body() accountData: CodePhoneAPI) {
    const { phone, code } = accountData;
    this.logger.log(
      `Verifying user by phone number ${phone} with code ${code}`,
    );
    await this.authService.verifyUser(phone, code);
    return {
      message: 'User verified!',
    };
  }

  @Post('checkResetCode')
  @ApiTags('auth')
  async checkResetCode(@Body() accountData: CodePhoneAPI) {
    const { phone, code } = accountData;
    this.logger.log(`Checking reset code ${code} with phone number ${phone}`);
    const res = await this.authService.checkIfCodeCorrect(phone, code);
    if (!res) {
      return {
        correct: false,
      };
    }

    this.logger.log('Signing with very quick expiration');
    const payload: JwtStrategyPayload = { sub: phone, phone: phone };
    return {
      correct: true,
      resetToken: await this.jwtService.signWithVeryQuickExpiration(payload),
    };
  }

  @Post('completeReset')
  @ApiTags('auth')
  async completeResetPassword(@Body() accountData: ResetPasswordAPI) {
    const { phone, resetToken, newPassword } = accountData;
    this.logger.log(`Confirming reset password for phone number ${phone}`);
    await this.authService.confirmResetPassword(phone, resetToken, newPassword);

    this.logger.log('Updated successfully');
    return {
      message: 'Updated successfully!',
    };
  }

  @Post('resend-confirmation')
  @ApiTags('auth')
  async resendConfirmation(@Body() data: PhoneBodyAPI) {
    this.logger.log(`Resending confirmation for phone number ${data.phone}`);
    await this.authService.resendConfirmation(data.phone);

    this.logger.log('Successfully sent confirmation sms');
    return {
      message: 'Successfully sent confirmation sms!',
    };
  }

  @Post('forgot-password')
  @ApiTags('auth')
  async resetPassword(@Body() data: PhoneBodyAPI) {
    this.logger.log(`Reseting password for phone number ${data.phone}`);
    await this.authService.resetPassword(data.phone);

    this.logger.log('Code sent successfully');
    return {
      message: 'Code sent successfully!',
    };
  }

  @Post('phone-exists')
  @ApiTags('auth')
  async phoneExists(@Body() data: PhoneBodyAPI) {
    this.logger.log(`Checking if phone number ${data.phone} exists`);
    return this.authService.phoneExists(data.phone);
  }
}
