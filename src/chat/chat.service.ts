import { INS, User } from '.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { connect, StreamClient } from 'getstream';

@Injectable()
export class ChatService {
  private connectClient(): StreamClient {
    return connect(
      process.env.GET_STREAM_API_KEY || '',
      process.env.GET_STREAM_API_SECRET || null,
      process.env.GET_STREAM_APP_ID,
      { location: process.env.GET_STREAM_LOCATION },
    );
  }

  async createStreamIDForUser(user: User) {
    const client = this.connectClient();
    return client.user(user.id).getOrCreate({
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
    });
  }

  async createStreamIDForINS(ins: INS) {
    const client = this.connectClient();
    return client.user(ins.id).getOrCreate({
      name: ins.name,
    });
  }

  async createStreamToken(id: string) {
    const client = this.connectClient();
    try {
      await client.user(id).get();
      return client.createUserToken(id);
    } catch (e) {
      throw new BadRequestException('Stream user does not exist');
    }
  }

  async deleteStreamUser(id: string) {
    const client = this.connectClient();
    try {
      const streamUSer = await client.user(id).delete();
      return streamUSer;
    } catch (e) {
      return;
    }
  }
}
