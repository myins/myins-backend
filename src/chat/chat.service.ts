import { INS, User } from '.prisma/client';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ChannelFilters, StreamChat, UserResponse } from 'stream-chat';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  private streamChat: StreamChat;

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
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
    return this.streamChat.upsertUsers(data);
  }

  async getStreamUser(id: string) {
    const users = await this.streamChat.queryUsers({ id });
    return users.users[0];
  }

  async deleteStreamUser(userID: string) {
    return this.streamChat.deleteUser(userID, {
      mark_messages_deleted: false,
    });
  }

  async createChannelINS(ins: INS, userID: string) {
    const channel = this.streamChat.channel('messaging', ins.id, {
      name: ins.name,
      members: [userID],
      created_by_id: userID,
      image: ins.cover,
      insChannel: true,
    });
    return channel.create();
  }

  async getChannelsINS(where: ChannelFilters) {
    return this.streamChat.queryChannels(where);
  }

  async deleteChannelINS(insID: string) {
    const channels = await this.getChannelsINS({ id: insID });
    return channels[0].delete();
  }

  async addMembersToChannel(userIDs: string[], insId: string) {
    const channels = await this.getChannelsINS({ id: insId });
    const users = await this.userService.users({
      where: {
        id: {
          in: userIDs,
        },
      },
    });
    await this.createOrUpdateStreamUsers(users);
    return channels[0].addMembers(userIDs);
  }

  async removeMemberFromChannel(userID: string, insId: string) {
    const channels = await this.getChannelsINS({ id: insId });
    return channels[0].removeMembers([userID]);
  }

  async sendMessageWhenPost(insIds: string[], userID: string, postID: string) {
    return this.sendMessageToChannels(insIds, userID, '', {
      custom_type: 'new_post',
      post_id: postID,
    });
  }

  async sendMessageToChannels(
    insIds: string[],
    userID: string,
    message: string,
    data: Record<string, unknown>,
  ) {
    const channels = await this.getChannelsINS({
      id: { $in: insIds },
    });
    const user = await this.getStreamUser(userID);
    return Promise.all(
      channels.map(async (channel) => {
        await channel.sendMessage({
          user_id: user.id,
          text: message,
          data,
        });
      }),
    );
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
    const users = allUsers.users.filter((user) => user.id !== 'cristipele7');
    this.logger.log(`Removing users ${users.map((user) => user.id)}`);
    await Promise.all(
      users.map(async (user) => {
        await this.streamChat.deleteUser(user.id);
      }),
    );
  }
}
