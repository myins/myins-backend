import { forwardRef, Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { MediaModule } from 'src/media/media.module';
import { PostModule } from 'src/post/post.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => InsModule),
    forwardRef(() => MediaModule),
    forwardRef(() => UserModule),
    forwardRef(() => PostModule),
  ],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
