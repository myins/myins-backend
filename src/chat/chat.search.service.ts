import { UserRole } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { InsService } from 'src/ins/ins.service';
import {
  ChannelFilters,
  MessageFilters,
  SearchOptions,
  StreamChat,
} from 'stream-chat';
import { SearchMessgesAPI } from './chat-api.entity';

@Injectable()
export class ChatSearchService {
  private streamChat: StreamChat;

  constructor(private readonly insService: InsService) {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  async searchMessages(userID: string, data: SearchMessgesAPI) {
    const channelFilters: ChannelFilters = data.channelId
      ? {
          id: { $eq: data.channelId },
        }
      : {
          id: {
            $in: (
              await this.insService.inses({
                where: {
                  members: {
                    some: {
                      userId: userID,
                      role: {
                        not: UserRole.PENDING,
                      },
                    },
                  },
                },
              })
            ).map((ins) => ins.id),
          },
        };

    let messageFilters: MessageFilters = data.mediaTypes
      ? {
          'attachments.type': { $in: data.mediaTypes },
        }
      : {};
    messageFilters = data.autocomplete?.length
      ? {
          ...messageFilters,
          text: { $autocomplete: data.autocomplete },
        }
      : messageFilters;
    messageFilters = data.onlyMine
      ? {
          ...messageFilters,
          'user.id': {
            $eq: userID,
          },
        }
      : messageFilters;
    if (
      !messageFilters['attachments.type'] &&
      !messageFilters.text &&
      !messageFilters.user_id
    ) {
      messageFilters = { created_at: { $lte: new Date().toISOString() } };
    }

    const options: SearchOptions = {
      sort: { created_at: -1 },
      limit: data.limit,
    };
    if (data.next) {
      options.next = data.next;
    }

    const search = await this.streamChat.search(
      channelFilters,
      messageFilters,
      options,
    );

    return {
      next: search.next ?? null,
      result: search.results,
    };
  }
}
