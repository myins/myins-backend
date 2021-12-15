import { forwardRef, Module } from '@nestjs/common';
import { InsModule } from 'src/ins/ins.module';
import { MediaModule } from 'src/media/media.module';
import { UserModule } from 'src/user/user.module';
import { ChatController } from './chat.controller';
import { ChatSearchService } from './chat.search.service';
import { ChatService } from './chat.service';

@Module({
  imports: [forwardRef(() => UserModule), InsModule, MediaModule],
  controllers: [ChatController],
  providers: [ChatService, ChatSearchService],
  exports: [ChatService],
})
export class ChatModule {}
