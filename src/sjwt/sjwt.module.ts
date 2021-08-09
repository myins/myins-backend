import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtService } from './sjwt.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SIGNING_KEY,
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
  ],
  providers: [SjwtService],
  exports: [SjwtService],
})
export class SjwtModule {}
