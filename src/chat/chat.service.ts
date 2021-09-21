import { INS } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { StreamChat } from 'stream-chat';

@Injectable()
export class ChatService {
  private getStreamChat(): StreamChat {
    return StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  async createChannelForINS(ins: INS, userID: string | null) {
    const streamChat = this.getStreamChat();
    const channel = streamChat.channel('messaging', ins.id, {
      name: ins.name,
      members: userID ? [userID] : [],
      created_by_id: userID,
    });
    return await channel.create();
  }

  createStreamChatToken(id: string) {
    const streamChat = this.getStreamChat();
    return streamChat.createToken(id);
  }
}
