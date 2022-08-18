import { Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { MediaModule } from 'src/media/media.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SjwtModule } from 'src/sjwt/sjwt.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [
    InsModule,
    SjwtModule,
    PostModule,
    PrismaModule,
    ChatModule,
    MediaModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
