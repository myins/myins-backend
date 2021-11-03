import { Injectable } from '@nestjs/common';
import { StreamChat } from 'stream-chat';
import { SearchMessgesAPI } from './chat-api.entity';

@Injectable()
export class ChatSearchService {
  private streamChat: StreamChat;

  constructor() {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  async searchMessages(userID: string, data: SearchMessgesAPI) {
    const search = await this.streamChat.search(
      { name: { $autocomplete: 'Second' } },
      {
        created_at: { $lte: new Date().toISOString() },
      },
      {
        sort: { created_at: -1 },
        limit: data.limit,
      },
    );

    return {
      me: 'esti un idiot ????',
      results_warning: search.results_warning ?? 'no warnings',
      next: search.next ?? 'next',
      previous: search.previous,
      page1Result: search.results,
    };
  }
}
