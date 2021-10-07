import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtStrategyPayload } from 'src/auth/jwt.strategy';
import { UserService } from 'src/user/user.service';

@Injectable()
export class SjwtService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async generateNewAuthTokens(phone: string, userID: string) {
    const newRefreshToken = crypto.randomBytes(64).toString('hex');

    await this.userService.updateUser({
      where: { id: userID },
      data: {
        refreshToken: newRefreshToken,
      },
    });
    const payload: JwtStrategyPayload = { phone: phone, sub: userID };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: newRefreshToken,
      cloudfrontToken: this.getCloudfrontToken(payload),
    };
  }

  getCloudfrontToken(toSign: JwtStrategyPayload) {
    return this.jwtService.sign(toSign, {
      expiresIn: '30s',
      secret: process.env.CLOUDFRONT_JWT_KEY,
    });
  }

  async signWithQuickExpiration(toSign: JwtStrategyPayload) {
    return this.jwtService.sign(toSign, {
      expiresIn: '8h',
    });
  }

  async signWithVeryQuickExpiration(toSign: JwtStrategyPayload) {
    return this.jwtService.sign(toSign, {
      expiresIn: '5m',
    });
  }

  async decrypt(token: string) {
    return this.jwtService.decode(token);
  }
}
