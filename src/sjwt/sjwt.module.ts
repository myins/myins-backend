import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { SjwtService } from './sjwt.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SIGNING_KEY,
      signOptions: { expiresIn: '7d' },
    }),
    forwardRef(() => UserModule),
  ],
  providers: [SjwtService],
  exports: [SjwtService],
})
export class SjwtModule {}
