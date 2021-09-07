import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { InsAdminController } from './ins.admin.controller';
import { InsAdminService } from './ins.admin.service';
import { InsController } from './ins.controller';
import { InsInteractionService } from './ins.interaction.service';
import { InsService } from './ins.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InsController, InsAdminController],
  providers: [InsService, InsInteractionService, InsAdminService],
  exports: [InsService, InsInteractionService],
})
export class InsModule {}
