import { Module } from '@nestjs/common';
import { CurrentVersionsController } from './current-versions.controller';
import { CurrentVersionsService } from './current-versions.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CurrentVersionsController],
  providers: [CurrentVersionsService],
  exports: [CurrentVersionsService],
})
export class CurrentVersionsModule {}
