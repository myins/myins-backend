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
import { PhoneBodyAPI, RefreshTokenBodyAPI } from './auth-api.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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

  @Post('verifyReset')
  @ApiTags('auth-frontend')
  async completeResetPassword(
    @Body() accountData: { token: string; newPassword: string },
  ) {
    return this.authService.completeResetPassword(
      accountData.token,
      accountData.newPassword,
    );
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
