import { forwardRef, Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { MediaModule } from 'src/media/media.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { StoryStickersService } from './story.stickers.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => InsModule),
    forwardRef(() => MediaModule),
    forwardRef(() => UserModule),
  ],
  controllers: [StoryController],
  providers: [StoryService, StoryStickersService],
  exports: [StoryService, StoryStickersService],
})
export class StoryModule {}
