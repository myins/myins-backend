import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface JwtStrategyPayload {
  sub: string;
  phone: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prismaService: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SIGNING_KEY,
    });
  }

  async validate(payload: JwtStrategyPayload) {
    const toRet = { userId: payload.sub, username: payload.phone };
    const user = await this.prismaService.user.findUnique({
      where: { id: toRet.userId },
    });
    if (!user) {
      throw new BadRequestException('Could not find user!');
    }
    return user;
  }
}
