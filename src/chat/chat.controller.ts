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
import { SearchMessgesAPI, SendMessageToStoryAPI } from './chat-api.entity';
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

  @Get('token')
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

  @Post('migration')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async migration() {
    this.logger.log(
      'Create channel for all inses and stream user for all users',
    );
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

    this.logger.log('Successfully migrated data');
    return {
      message: 'Successfully migrated data',
    };
  }

  @Post('search')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async searchMessages(
    @PrismaUser('id') userID: string,
    @Body() data: SearchMessgesAPI,
  ) {
    if (data.channelId) {
      const connection =
        await this.userConnectionService.getNotPendingConnection({
          userId_insId: {
            insId: data.channelId,
            userId: userID,
          },
        });
      if (!connection) {
        this.logger.error(
          "You're not allowed to search messages in this channel!",
        );
        throw new BadRequestException(
          "You're not allowed to search messages in this channel!",
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

  @Post('story-message')
  @UseGuards(JwtAuthGuard)
  @ApiTags('chat')
  async sendMessageFromStory(
    @PrismaUser('id') userID: string,
    @Body() data: SendMessageToStoryAPI,
  ) {
    this.logger.log(
      `Sending message from story media ${data.mediaID} by user ${userID}`,
    );
    await this.chatService.sendMessageFromStory(
      userID,
      data.message,
      data.mediaID,
    );

    this.logger.log('Successfully sent message from story');
    return {
      message: 'Successfully sent message from story',
    };
  }
}
