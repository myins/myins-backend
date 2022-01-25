import { INS, PostContent, Story, User } from '.prisma/client';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Channel, ChannelFilters, StreamChat, UserResponse } from 'stream-chat';
import { UserService } from 'src/user/user.service';
import { InsService } from 'src/ins/ins.service';
import { Cron } from '@nestjs/schedule';
import { MediaService } from 'src/media/media.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { SendMessageToStoryAPI } from './chat-api.entity';
import { isProd } from 'src/util/is-prod';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  private streamChat: StreamChat;

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly insService: InsService,
    private readonly mediaService: MediaService,
  ) {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  @Cron('0 1 * * *')
  async cleanUpStreamChat() {
    if (!isProd()) {
      try {
        this.logger.log('[Cron] Clean up stream chat users');

        this.logger.log('[Cron] Getting users from db');
        const users = await this.userService.users({});
        const usersIDs = users.map((user) => user.id);

        this.logger.log('[Cron] Getting stream chat users');
        const limit = 100;
        let offset = 0;
        let streamUsers;
        const allUsersIDs: string[] = [];
        do {
          streamUsers = await this.streamChat.queryUsers(
            {},
            { created_at: 1 },
            { limit, offset },
          );
          const userIDs: string[] = streamUsers.users
            .filter((streamUser) => streamUser.role === 'user')
            .map((streamUser) => streamUser.id);
          allUsersIDs.push(...userIDs);
          offset = offset + limit;
        } while (streamUsers.users.length);

        const nonexistentUsersIDs = allUsersIDs.filter(
          (userID) => !usersIDs.includes(userID),
        );
        await Promise.all(
          nonexistentUsersIDs.map(async (userID) => {
            await this.deleteStreamUser(userID);
          }),
        );

        this.logger.log(
          `[Cron] Cleaned up ${nonexistentUsersIDs.length} nonexistent stream users!`,
        );

        this.logger.log('[Cron] Clean up channels');

        this.logger.log('[Cron] Getting inses from db');
        const inses = await this.insService.inses({});
        const insesIDs = inses.map((ins) => ins.id);

        this.logger.log('[Cron] Getting channels');
        offset = 0;
        let channels;
        const allChannels: Channel[] = [];
        do {
          channels = await this.streamChat.queryChannels(
            { insChannel: true },
            { created_at: 1 },
            { limit, offset },
          );
          allChannels.push(...channels);
          offset = offset + limit;
        } while (channels.length);

        const nonexistentChannels = allChannels.filter(
          (channel) => channel.id && !insesIDs.includes(channel.id),
        );
        await Promise.all(
          nonexistentChannels.map(async (channel) => {
            await channel.delete();
          }),
        );

        this.logger.log(
          `[Cron] Cleaned up ${nonexistentChannels.length} nonexistent channels!`,
        );
      } catch (e) {
        const stringErr: string = <string>e;
        this.logger.error(
          `[Cron] Error cleaned up stream chat! + ${stringErr}`,
        );
      }
    }
  }

  createStreamChatToken(id: string) {
    return this.streamChat.createToken(id);
  }

  async createOrUpdateStreamUsers(users: User[]) {
    const data: UserResponse[] = users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
      image: user.profilePicture,
    }));

    try {
      await this.streamChat.upsertUsers(data);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        `Error creating/updating stream chat user! Chat will not work! + ${stringErr}`,
      );
    }
  }

  async getStreamUser(id: string) {
    const users = await this.streamChat.queryUsers({ id });
    return users.users[0];
  }

  async deleteStreamUser(userID: string) {
    try {
      await this.streamChat.deleteUser(userID, {
        mark_messages_deleted: false,
      });
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error deleting stream chat user! + ${stringErr}`);
    }
  }

  async updateDeviceToken(
    userID: string,
    oldDeviceToken: string | null,
    deviceToken: string | null,
  ) {
    if (oldDeviceToken) {
      try {
        this.logger.log(
          `Removing device token ${oldDeviceToken} for user stream ${userID}`,
        );
        await this.streamChat.removeDevice(oldDeviceToken, userID);
      } catch (e) {
        const stringErr: string = <string>e;
        this.logger.error(
          `Error removing device token for stream chat user! + ${stringErr}`,
        );
      }
    }
    if (deviceToken) {
      try {
        this.logger.log(
          `Adding device token ${deviceToken} for user stream ${userID}`,
        );
        await this.streamChat.addDevice(deviceToken, 'apn', userID);
      } catch (e) {
        const stringErr: string = <string>e;
        this.logger.error(
          `Error adding device token for stream chat user! + ${stringErr}`,
        );
      }
    }
  }

  async removeAllDevices(userID: string) {
    try {
      const devices = await this.streamChat.getDevices(userID);
      if (devices.devices) {
        await Promise.all(
          devices.devices?.map(async (device) => {
            await this.streamChat.removeDevice(device.id, userID);
          }),
        );
      }
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        `Error removing all devices tokens for stream chat user! + ${stringErr}`,
      );
    }
  }

  async createChannelINS(ins: INS, userID: string) {
    try {
      const channel = this.streamChat.channel('messaging', ins.id, {
        name: ins.name,
        members: [userID],
        created_by_id: userID,
        image: ins.cover,
        insChannel: true,
      });
      await channel.create();
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error creating stream channel! + ${stringErr}`);
    }
  }

  async createOneToOneChannel(userID: string, receiverID: string) {
    try {
      const channel = this.streamChat.channel('messaging', {
        members: [userID, receiverID],
        created_by_id: userID,
        insChannel: false,
      });
      await channel.create();
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error creating stream channel! + ${stringErr}`);
    }
  }

  async createChannelINSWithMembersIfNotExists(ins: INS, userID: string) {
    try {
      const channels = await this.getChannelsINS({ id: ins.id });
      if (!channels.length) {
        this.logger.log(
          `Channel ${ins.id} not exist. Create channel and add all members`,
        );
        await this.createChannelINS(ins, userID);

        const members = await this.insService.membersForIns(ins.id);
        if (members.length) {
          await this.addMembersToChannel(
            members.map((member) => member.id),
            ins.id,
          );
        }
      } else {
        this.logger.log(
          `Channel ${ins.id} exist. Add members that are not in channel`,
        );
        await this.addMembersIfNotInChannel(channels[0]);
      }
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error creating stream channel! + ${stringErr}`);
    }
  }

  async getChannelsINS(where: ChannelFilters) {
    return this.streamChat.queryChannels(where);
  }

  async deleteChannelINS(insID: string) {
    try {
      const channels = await this.getChannelsINS({ id: insID });
      await channels[0].delete();
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error deleting stream channel! + ${stringErr}`);
    }
  }

  async addMembersToChannel(userIDs: string[], insId: string) {
    try {
      const channels = await this.getChannelsINS({ id: insId });
      const users = await this.userService.users({
        where: {
          id: {
            in: userIDs,
          },
        },
      });
      await this.createOrUpdateStreamUsers(<User[]>users);
      await channels[0].addMembers(userIDs);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        `Error adding members to stream channel! + ${stringErr}`,
      );
    }
  }

  async addMembersIfNotInChannel(channel: Channel) {
    if (channel.id) {
      const members = await this.insService.membersForIns(channel.id);
      const membersChannelIDs = (await channel.queryMembers({})).members.map(
        (member) => member.user_id,
      );
      const membersNotInChannel = members.filter(
        (member) => !membersChannelIDs.includes(member.id),
      );
      if (membersNotInChannel.length) {
        await this.addMembersToChannel(
          membersNotInChannel.map((member) => member.id),
          channel.id,
        );
      }
    }
  }

  async removeMemberFromChannel(userID: string, insId: string) {
    try {
      const channels = await this.getChannelsINS({ id: insId });
      await channels[0].removeMembers([userID]);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        `Error removing member from stream channel! + ${stringErr}`,
      );
    }
  }

  async sendMessageWhenPost(insIds: string[], userID: string, postID: string) {
    return this.sendMessageToChannels(
      insIds,
      userID,
      '',
      {
        custom_type: 'new_post',
        post_id: postID,
      },
      true,
      true,
    );
  }

  async sendMessageFromStory(userID: string, data: SendMessageToStoryAPI) {
    const { mediaID, message, insID } = data;
    this.logger.log(`Getting media ${mediaID}`);
    const media = await this.mediaService.getMediaById(
      {
        id: mediaID,
      },
      {
        story: {
          include: {
            author: {
              select: ShallowUserSelect,
            },
          },
        },
      },
    );
    if (!media) {
      this.logger.error('Story media not found!');
      throw new NotFoundException('Story media not found!');
    }

    const receiver: User = (<
      PostContent & {
        story: Story & {
          author: User;
        };
      }
    >media).story.author;
    this.logger.log(
      `Getting channel 1 to 1 between user ${userID} and user ${receiver.id}`,
    );
    let channel;
    const channels = await this.getChannelsINS({
      members: {
        $eq: [userID, receiver.id],
      },
      insChannel: {
        $eq: false,
      },
    });
    channel = channels[0];
    if (!channel) {
      this.logger.log(
        `Channel between user ${userID} and user ${receiver.id} does not exists. Creating channel`,
      );
      await this.createOneToOneChannel(userID, receiver.id);
      const channelsOneToOne = await this.getChannelsINS({
        members: {
          $eq: [userID, receiver.id],
        },
        insChannel: {
          $eq: false,
        },
      });
      channel = channelsOneToOne[0];
    }
    if (channel.id) {
      const createdAt = new Date(media.createdAt);
      const expiryDate = new Date(createdAt.setDate(createdAt.getDate() + 1));
      expiryDate.setMinutes(
        expiryDate.getMinutes() + 10 - (expiryDate.getMinutes() % 10),
      );
      expiryDate.setSeconds(0);
      expiryDate.setMilliseconds(0);
      await this.sendMessageToChannels([channel.id], userID, message, {
        custom_type: 'story_message',
        mediaContent: {
          ...media,
          expiryDate,
          insID,
        },
      });
    } else {
      this.logger.error('Error sending messsage from story!');
      throw new BadRequestException('Error sending messsage from story!');
    }
  }

  async sendMessageToChannels(
    insIds: string[],
    userID: string,
    message: string,
    data: Record<string, unknown>,
    silent?: boolean,
    skip_push?: boolean,
  ) {
    try {
      const channels = await this.getChannelsINS({
        id: { $in: insIds },
      });
      const user = await this.getStreamUser(userID);
      await Promise.all(
        channels.map(async (channel) => {
          await channel.sendMessage(
            {
              user_id: user.id,
              text: message,
              silent: silent ?? false,
              data,
            },
            {
              skip_push: skip_push ?? false,
            },
          );
        }),
      );
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        `Error sending message to stream channel! + ${stringErr}`,
      );
    }
  }

  // For test purpose in specially
  async removeAll() {
    const channels = await this.streamChat.queryChannels({});
    this.logger.log(
      `Removing channels ${channels.map((channel) => channel.id)}`,
    );
    await Promise.all(
      channels.map(async (channel) => {
        await channel.delete();
      }),
    );

    const allUsers = await this.streamChat.queryUsers({});
    const users = allUsers.users.filter((user) => user.role === 'user');
    this.logger.log(`Removing users ${users.map((user) => user.id)}`);
    await Promise.all(
      users.map(async (user) => {
        await this.streamChat.deleteUser(user.id);
      }),
    );
  }
}
