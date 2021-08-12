import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InsController } from './ins.controller';
import { InsService } from './ins.service';

@Module({
  imports: [PrismaModule],
  controllers: [InsController],
  providers: [InsService]
})
export class InsModule {}
