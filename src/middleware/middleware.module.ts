import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MiddlewareService } from './middleware.service';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [PrismaModule, ChatModule],
  providers: [MiddlewareService],
})
export class MiddlewareModule {}
