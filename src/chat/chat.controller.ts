import {
  Controller,
  UseInterceptors,
  Get,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { ChatService } from './chat.service';

@Controller('chat')
@UseInterceptors(NotFoundInterceptor)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':id/token')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async getStreamChatToken(@Param('id') id: string) {
    const token = this.chatService.createStreamChatToken(id);
    return {
      accessTokenStream: token,
    };
  }
}
