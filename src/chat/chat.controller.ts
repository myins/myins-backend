import {
  Controller,
  UseInterceptors,
  Get,
  UseGuards,
  Logger,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserConnectionService } from 'src/user/user.connection.service';
import { SearchMessgesAPI } from './chat-api.entity';
import { ChatSearchService } from './chat.search.service';
import { ChatService } from './chat.service';

@Controller('chat')
@UseInterceptors(NotFoundInterceptor)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatSearchService: ChatSearchService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
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

  @Post('/search')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async searchMessages(
    @PrismaUser('id') userID: string,
    @Body() data: SearchMessgesAPI,
  ) {
    if (data.channelId) {
      const connection = this.userConnectionService.getNotPendingConnection({
        userId_insId: {
          insId: data.channelId,
          userId: userID,
        },
      });
      if (!connection) {
        this.logger.error(
          "You're not allowed to search message in this channel!",
        );
        throw new BadRequestException(
          "You're not allowed to search message in this channel!",
        );
      }
    }
    this.logger.log(
      `Searching for messages with data ${JSON.stringify(
        data,
      )} by user ${userID}`,
    );
    return this.chatSearchService.searchMessages(userID, data);
  }
}
