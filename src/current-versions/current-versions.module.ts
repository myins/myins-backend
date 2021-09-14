import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CurrentVersionsController } from './current-versions.controller';
import { CurrentVersionsService } from './current-versions.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurrentVersionsController],
  providers: [CurrentVersionsService],
  exports: [CurrentVersionsService],
})
export class CurrentVersionsModule {}
