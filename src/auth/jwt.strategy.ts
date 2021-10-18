import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';

export interface JwtStrategyPayload {
  sub: string;
  phone: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SIGNING_KEY,
    });
  }

  async validate(payload: JwtStrategyPayload) {
    const toRet = { userId: payload.sub, username: payload.phone };
    const user = await this.userService.user({ id: toRet.userId });
    if (!user) {
      this.logger.error('Could not find user!');
      throw new BadRequestException('Could not find user!');
    }
    return user;
  }
}
