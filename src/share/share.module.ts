import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';

@Module({
  //imports: [NotificationModule],
  controllers: [ShareController]
})
export class ShareModule {}
