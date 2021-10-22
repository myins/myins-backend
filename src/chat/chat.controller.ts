import {
  Controller,
  UseInterceptors,
  Get,
  UseGuards,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { ChatService } from './chat.service';

@Controller('chat')
@UseInterceptors(NotFoundInterceptor)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly insService: InsService,
  ) {}

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

  @Post('create-all-channels')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async createAllChannels() {
    this.logger.log('Create channels for all inses');
    const allINses = await this.insService.insesWithAdmin();
    await Promise.all(
      allINses.map(async (ins) => {
        if (ins.members.length) {
          this.logger.log(
            `Create channel for ins ${ins.id} by user stream ${ins.members[0].userId} if not exists`,
          );
          await this.chatService.createChannelINSWithMembersIfNotExists(
            ins,
            ins.members[0].userId,
          );
        }
      }),
    );
    return {
      message: 'All channels created',
    };
  }
}
