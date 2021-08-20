import { Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [InsModule, SjwtModule, PostModule, PrismaModule],
  controllers: [OnboardingController]
})
export class OnboardingModule {}
