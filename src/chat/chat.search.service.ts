import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ChannelFilters,
  LiteralStringForUnion,
  MessageFilters,
  SearchAPIResponse,
  SearchOptions,
  StreamChat,
  UnknownType,
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
    allMessages?: true,
    createdAtQuery?: {
      gte: Date | undefined;
      lte: Date | undefined;
    },
  ) {
    const channelFilters: ChannelFilters = allMessages
      ? { created_at: { $lte: new Date().toISOString() } }
      : data.channelId
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
    messageFilters = allMessages
      ? {
          ...messageFilters,
          text: { $ne: '' },
        }
      : data.autocomplete?.length
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
    if (allMessages) {
      const filterCreatedAt = {
        ...messageFilters,
      };
      if (createdAtQuery?.lte && createdAtQuery?.gte) {
        filterCreatedAt.$and = [
          {
            created_at: {
              $lte: createdAtQuery?.lte
                ? createdAtQuery?.lte.toISOString()
                : null,
            },
          },
          {
            created_at: {
              $gte: createdAtQuery?.gte
                ? createdAtQuery?.gte.toISOString()
                : null,
            },
          },
        ];
      } else if (createdAtQuery?.lte) {
        filterCreatedAt.created_at = {
          $lte: createdAtQuery.lte.toISOString(),
        };
      } else if (createdAtQuery?.gte) {
        filterCreatedAt.created_at = {
          $gte: createdAtQuery.gte.toISOString(),
        };
      }
      messageFilters = filterCreatedAt;
    }
    if (
      !messageFilters['attachments.type'] &&
      !messageFilters.text &&
      !messageFilters.user_id &&
      !(messageFilters.$and || messageFilters.created_at)
    ) {
      messageFilters = { created_at: { $lte: new Date().toISOString() } };
    }

    const options: SearchOptions = {
      sort: { created_at: -1 },
      limit: data.limit ?? 100,
    };
    if (data.next) {
      options.next = data.next;
    }

    let search: SearchAPIResponse<
      UnknownType,
      UnknownType,
      LiteralStringForUnion,
      UnknownType,
      UnknownType,
      UnknownType
    > | null = null;
    try {
      search = await this.streamChat.search(
        channelFilters,
        messageFilters,
        options,
      );

      if (!allMessages) {
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

        if (data.unwrappedAttachments) {
          search.results.forEach((message, index) => {
            if (message.message.args === 'isAdded') {
              return;
            }
            if (
              message.message.attachments?.length &&
              message.message.attachments?.length > 1
            ) {
              message.message.attachments.forEach(
                (attachment, indexAttachments) => {
                  const newMessage = {
                    message: {
                      ...message.message,
                      attachments: [attachment],
                      args: 'isAdded',
                    },
                  };
                  search?.results.splice(
                    index + indexAttachments,
                    0,
                    newMessage,
                  );
                },
              );
              search?.results.splice(
                index + message.message.attachments.length,
                1,
              );
            }
          });
        }
      }
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error searching for messages! + ${stringErr}`);
      throw new BadRequestException(`Error searching for messages!`);
    }

    return {
      next: search.next ?? null,
      result: allMessages
        ? search.results
            .map((message) => message.message.text ?? '')
            .filter((message) => message.length > 2)
        : search.results,
    };
  }
}
