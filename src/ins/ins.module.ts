import { Module } from '@nestjs/common';
import { ChatModule } from 'src/chat/chat.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { InsAdminController } from './ins.admin.controller';
import { InsAdminService } from './ins.admin.service';
import { InsController } from './ins.controller';
import { InsInteractionService } from './ins.interaction.service';
import { InsService } from './ins.service';

@Module({
  imports: [PrismaModule, StorageModule, ChatModule],
  controllers: [InsController, InsAdminController],
  providers: [InsService, InsInteractionService, InsAdminService],
  exports: [InsService, InsInteractionService],
})
export class InsModule {}
