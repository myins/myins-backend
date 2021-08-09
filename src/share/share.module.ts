import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ShareController } from './share.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ShareController]
})
export class ShareModule {}
