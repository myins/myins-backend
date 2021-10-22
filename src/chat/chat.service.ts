import { INS, User } from '.prisma/client';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, ChannelFilters, StreamChat, UserResponse } from 'stream-chat';
import { UserService } from 'src/user/user.service';
import { InsService } from 'src/ins/ins.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  private streamChat: StreamChat;

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly insService: InsService,
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

    try {
      await this.streamChat.upsertUsers(data);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(
        'Error creating/updating stream chat user! Chat will not work',
        stringErr,
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
      this.logger.error('Error deleting stream chat user!', stringErr);
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
      this.logger.error('Error creating stream channel!', stringErr);
    }
  }

  async createChannelINSWithMembersIfNotExists(ins: INS, userID: string) {
    try {
      const channels = await this.getChannelsINS({ id: ins.id });
      if (!channels.length) {
        await this.createChannelINS(ins, userID);

        const members = await this.insService.membersForIns(ins.id);
        if (members.length) {
          this.addMembersToChannel(
            members.map((member) => member.id),
            ins.id,
          );
        }
      } else {
        await this.addMembersIfNotInChannel(channels[0]);
      }
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error('Error creating stream channel!', stringErr);
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
      this.logger.error('Error deleting stream channel!', stringErr);
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
      await this.createOrUpdateStreamUsers(users);
      await channels[0].addMembers(userIDs);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error('Error adding members to stream channel!', stringErr);
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
        'Error removing member from stream channel!',
        stringErr,
      );
    }
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
    try {
      const channels = await this.getChannelsINS({
        id: { $in: insIds },
      });
      const user = await this.getStreamUser(userID);
      await Promise.all(
        channels.map(async (channel) => {
          await channel.sendMessage({
            user_id: user.id,
            text: message,
            data,
          });
        }),
      );
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error('Error sending message to stream channel!', stringErr);
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
    const users = allUsers.users.filter((user) => user.id !== 'cristipele7');
    this.logger.log(`Removing users ${users.map((user) => user.id)}`);
    await Promise.all(
      users.map(async (user) => {
        await this.streamChat.deleteUser(user.id);
      }),
    );
  }
}
