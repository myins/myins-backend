import { INS, User } from '.prisma/client';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { StreamChat, UserResponse } from 'stream-chat';
import { UserService } from 'src/user/user.service';
import { omit } from 'src/util/omit';

@Injectable()
export class ChatService {
  private streamChat: StreamChat;

  constructor(
    @Inject(forwardRef(() => UserService)) private userService: UserService,
  ) {
    this.streamChat = StreamChat.getInstance(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET,
    );
  }

  createStreamChatToken(id: string) {
    return this.streamChat.createToken(id);
  }

  async createOrUpdateStreamChatUsers(users: User[]) {
    const data = users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
      image: user.profilePicture,
    }));
    await this.streamChat.upsertUsers(data);
  }

  async getUser(id: string) {
    const users = await this.streamChat.queryUsers({ id });
    return users.users[0];
  }

  async deleteStreamChatUser(userID: string) {
    await this.streamChat.deleteUser(userID, {
      mark_messages_deleted: false,
    });
  }

  async createChannelINS(ins: INS, userID: string) {
    const channel = this.streamChat.channel('messaging', ins.id, {
      name: ins.name,
      members: [userID],
      created_by_id: userID,
      image: ins.cover,
    });
    return await channel.create();
  }

  async getChannel(id: string) {
    const channels = await this.streamChat.queryChannels({ id });
    return channels[0];
  }

  async deleteChannelINS(insID: string) {
    const channel = await this.getChannel(insID);
    await channel.delete();
  }

  async addMembersToChannel(userIDs: string[], insId: string) {
    const channel = await this.getChannel(insId);
    const users = await this.userService.users({
      where: {
        id: {
          in: userIDs,
        },
      },
    });
    await this.createOrUpdateStreamChatUsers(users);
    await channel.addMembers(userIDs);
  }

  async removeMemberFromChannel(userID: string, insId: string) {
    const channel = await this.getChannel(insId);
    await channel.removeMembers([userID]);
  }

  async sendMessageWhenPost(insIds: string[], userID: string, content: string) {
    const message = `Post created by ${userID}: "${content}"`;
    return this.sendMessageToChannels(insIds, userID, message);
  }

  async sendMessageToChannels(
    insIds: string[],
    userID: string,
    message: string,
  ) {
    const channels = await this.streamChat.queryChannels({
      id: { $in: insIds },
    });
    const user = await this.getUser(userID);
    const myUser = <UserResponse>(
      omit(user, 'created_at', 'updated_at', 'last_active')
    );

    return Promise.all(
      channels.map(async (channel) => {
        await channel.sendMessage({
          user: myUser,
          text: message,
        });
      }),
    );
  }
}
