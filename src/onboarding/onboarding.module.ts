import { Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { InsModule } from 'src/ins/ins.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [InsModule, SjwtModule, PostModule, PrismaModule, ChatModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
