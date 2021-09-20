import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CjwtService } from './cjwt.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.CLOUDFRONT_JWT_KEY,
      signOptions: { expiresIn: '1d' },
    })],
  providers: [CjwtService],
  exports: [CjwtService],
})
export class CjwtModule { }
