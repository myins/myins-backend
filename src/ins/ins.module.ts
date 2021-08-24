import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { InsController } from './ins.controller';
import { InsInteractionService } from './ins.interaction.service';
import { InsService } from './ins.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InsController],
  providers: [InsService, InsInteractionService],
  exports: [InsService, InsInteractionService],
})
export class InsModule {}
