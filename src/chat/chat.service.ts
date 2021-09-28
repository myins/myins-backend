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

  async createStreamChatUsers(users: User[]) {
    const data = users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
    }));
    await this.streamChat.upsertUsers(data);
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
    });
    return await channel.create();
  }

  async deleteChannelINS(insID: string) {
    const channels = await this.streamChat.queryChannels({ id: insID });
    await channels[0].delete();
  }

  async addMembersToChannel(userIDs: string[], insId: string) {
    const channels = await this.streamChat.queryChannels({ id: insId });
    const users = await this.userService.users({
      where: {
        id: {
          in: userIDs,
        },
      },
    });
    await this.createStreamChatUsers(users);

    // FIXME: remove this check once all inses have chat channels
    if (channels.length) {
      await channels[0].addMembers(userIDs);
    }
  }

  async removeMemberFromChannel(userID: string, insId: string) {
    const channels = await this.streamChat.queryChannels({ id: insId });
    await channels[0].removeMembers([userID]);
  }

  async sendMessageToChannels(
    insIds: string[],
    userID: string,
    message: string,
  ) {
    const channels = await this.streamChat.queryChannels({
      id: { $in: insIds },
    });
    const users = await this.streamChat.queryUsers({ id: userID });
    const user = users.users[0];
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
