import { Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MiddlewareService } from './middleware.service';

@Module({
  imports: [PrismaModule, ChatModule],
  providers: [MiddlewareService],
})
export class MiddlewareModule {}
