import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UserID } from 'src/decorators/user-id.decorator';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { PhoneBodyAPI, RefreshTokenBodyAPI } from './auth-api.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategyPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly jwtService: SjwtService) { }

  @UseGuards(AuthGuard('local'))
  @ApiTags('auth')
  @Post('login')
  async login(@Request() req: { user: User }) {
    return await this.authService.login(req.user);
  }

  @Post('refresh-auth')
  @ApiTags('auth')
  @ApiBearerAuth()
  async refreshAuth(@Body() postData: RefreshTokenBodyAPI) {
    return await this.authService.refreshToken(
      postData.userID,
      postData.refreshToken,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('logout')
  @ApiTags('auth')
  @ApiBearerAuth()
  async logout(@UserID() user: string) {
    return this.authService.logout(user);
  }

  @Post('verifyCode')
  @ApiTags('auth')
  async verifyUser(
    @Body() accountData: { code: string; phone: string },
  ) {
    const { phone, code } = accountData
    return this.authService.verifyUser(phone, code)
  }

  @Post('checkResetCode')
  @ApiTags('auth')
  async checkResetCode(
    @Body() accountData: { code: string; phone: string },
  ) {
    const { phone, code } = accountData

    const res = await this.authService.checkIfCodeCorrect(phone, code)
    if (!res) {
      return {
        correct: false
      }
    }
    const payload: JwtStrategyPayload = { sub: phone, phone: phone };
    return {
      correct: true,
      resetToken: await this.jwtService.signWithVeryQuickExpiration(payload)
    }
  }

  @Post('completeReset')
  @ApiTags('auth')
  async completeResetPassword(
    @Body() accountData: { resetToken: string; newPassword: string, phone: string },
  ) {
    const { phone, resetToken, newPassword } = accountData
    return this.authService.confirmResetPassword(phone, resetToken, newPassword);
  }

  @Post('resend-confirmation')
  @ApiTags('auth')
  async resendConfirmation(@Body() data: PhoneBodyAPI) {
    return this.authService.resendConfirmation(data.phone);
  }

  @Post('forgot-password')
  @ApiTags('auth')
  async resetPassword(@Body() data: PhoneBodyAPI) {
    return this.authService.resetPassword(data.phone);
  }

  @Post('phone-exists')
  @ApiTags('auth')
  async phoneExists(@Body() data: PhoneBodyAPI) {
    return this.authService.phoneExists(data.phone);
  }
}
