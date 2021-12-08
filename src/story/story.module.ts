import { forwardRef, Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [PrismaModule, forwardRef(() => InsModule)],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
