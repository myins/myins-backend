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
    this.logger.log('User login');
    return this.authService.login(req.user);
  }

  @Post('refresh-auth')
  @ApiTags('auth')
  @ApiBearerAuth()
  async refreshAuth(@Body() postData: RefreshTokenBodyAPI) {
    this.logger.log('Refresh token');
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
    this.logger.log('User logout');
    return this.authService.logout(user);
  }

  @Post('verifyCode')
  @ApiTags('auth')
  async verifyUser(@Body() accountData: CodePhoneAPI) {
    this.logger.log('Verify user');
    const { phone, code } = accountData;
    await this.authService.verifyUser(phone, code);
    return {
      message: 'User verified!',
    };
  }

  @Post('checkResetCode')
  @ApiTags('auth')
  async checkResetCode(@Body() accountData: CodePhoneAPI) {
    this.logger.log('Check reset code');
    const { phone, code } = accountData;
    const res = await this.authService.checkIfCodeCorrect(phone, code);
    if (!res) {
      return {
        correct: false,
      };
    }

    this.logger.log('Sign with very quick expiration');
    const payload: JwtStrategyPayload = { sub: phone, phone: phone };
    return {
      correct: true,
      resetToken: await this.jwtService.signWithVeryQuickExpiration(payload),
    };
  }

  @Post('completeReset')
  @ApiTags('auth')
  async completeResetPassword(@Body() accountData: ResetPasswordAPI) {
    this.logger.log('Confirm reset password');
    const { phone, resetToken, newPassword } = accountData;
    await this.authService.confirmResetPassword(phone, resetToken, newPassword);
    return {
      message: 'Updated successfully!',
    };
  }

  @Post('resend-confirmation')
  @ApiTags('auth')
  async resendConfirmation(@Body() data: PhoneBodyAPI) {
    this.logger.log('Resend confirmation');
    await this.authService.resendConfirmation(data.phone);

    this.logger.log('Successfully sent confirmation sms');
    return {
      message: 'Successfully sent confirmation sms!',
    };
  }

  @Post('forgot-password')
  @ApiTags('auth')
  async resetPassword(@Body() data: PhoneBodyAPI) {
    this.logger.log('Reset password');
    await this.authService.resetPassword(data.phone);

    this.logger.log('Code sent successfully');
    return {
      message: 'Code sent successfully!',
    };
  }

  @Post('phone-exists')
  @ApiTags('auth')
  async phoneExists(@Body() data: PhoneBodyAPI) {
    this.logger.log('Check if phone exists');
    return this.authService.phoneExists(data.phone);
  }
}
