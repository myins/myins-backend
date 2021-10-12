import {
  Controller,
  UseInterceptors,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { ChatService } from './chat.service';

@Controller('chat')
@UseInterceptors(NotFoundInterceptor)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Get('/token')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async getStreamChatToken(@PrismaUser('id') userID: string) {
    this.logger.log(`Getting stream chat token for user ${userID}`);
    const token = this.chatService.createStreamChatToken(userID);

    this.logger.log(
      `Stream chat token successfully generated for user ${userID}`,
    );
    return {
      accessTokenStream: token,
    };
  }
}
