import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MiddlewareService } from './middleware.service';

@Module({
  imports: [PrismaModule],
  providers: [MiddlewareService],
})
export class MiddlewareModule {}
