import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ChannelFilters,
  MessageFilters,
  SearchOptions,
  StreamChat,
} from 'stream-chat';
import { SearchMessgesAPI } from './chat-api.entity';

@Injectable()
export class ChatSearchService {
  private readonly logger = new Logger(ChatSearchService.name);

  private streamChat: StreamChat;

  constructor() {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  async searchMessages(
    userID: string,
    data: SearchMessgesAPI,
    lastClearedAt: Date | null | undefined,
  ) {
    const channelFilters: ChannelFilters = data.channelId
      ? {
          id: { $eq: data.channelId },
        }
      : {
          members: {
            $in: [userID],
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

    let search = null;
    try {
      search = await this.streamChat.search(
        channelFilters,
        messageFilters,
        options,
      );

      search.results.map((message) => {
        if (message.message.attachments?.length) {
          if (lastClearedAt) {
            const createdAtDate = message.message.created_at
              ? new Date(message.message.created_at)
              : null;
            if (createdAtDate && createdAtDate < lastClearedAt) {
              message.message.args = 'shouldDelete';
              return;
            }
          }

          message.message.attachments = message.message.attachments?.filter(
            (attachment) => !attachment.title_link,
          );
          if (!message.message.attachments.length) {
            message.message.args = 'shouldDelete';
          }
        }
      });
      search.results = search.results.filter(
        (message) => message.message.args !== 'shouldDelete',
      );
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error searching for messages! + ${stringErr}`);
      throw new BadRequestException(`Error searching for messages!`);
    }

    return {
      next: search.next ?? null,
      result: search.results,
    };
  }
}
