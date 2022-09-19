import { Module } from '@nestjs/common';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StoryModule } from 'src/story/story.module';
import { UserModule } from 'src/user/user.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [PrismaModule, UserModule, PostModule, StoryModule],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
