import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategyPayload } from 'src/auth/jwt.strategy';

@Injectable()
export class CjwtService {
    constructor(private jwtService: JwtService) {}

    async generateNewCloudfrontToken(phone: string, userID: string) {
        const payload: JwtStrategyPayload = { phone: phone, sub: userID };
    
        return {
          jwt: this.jwtService.sign(payload),
        };
      }

}
