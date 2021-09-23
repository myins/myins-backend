import { INS, UserInsConnection } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MiddlewareService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly chatService: ChatService,
  ) {
    // Ready for use

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);
      if (params.model == 'INS') {
        if (params.action == 'delete') {
          // An INS was deleted, remove it's channel
          await this.chatService.deleteChannelINS(result.id);
        }
        if (params.action == 'create') {
          // An INS was created, create the corresponding GetStream channel
          // Attention, this only works for inses created with a member
          // For other ones, such as onboarding INSes, the call is done manually in the OnboardingService.
          const insResult = <INS>result;
          const createMembers = params.args.data.members;
          if (createMembers) {
            // This is a claimed INS
            const createdOwnerID = <string>createMembers.create.userId;
            await this.chatService.createChannelINS(insResult, createdOwnerID);
          }
        }
      }
      return result;
    });

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);

      if (params.model == 'UserInsConnection' && params.action == 'delete') {
        // A user left an INS, remove them from the channel.
        const userInsResult = <UserInsConnection>result;
        await this.chatService.removeMemberFromChannel(
          userInsResult.userId,
          userInsResult.insId,
        );
      }

      return result;
    });

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);
      if (params.model == 'User') {
        if (params.action == 'delete') {
          // A user was deleted, remove them from stream.
          await this.chatService.deleteStreamChatUser(result.id);
        } else if (params.action == 'create') {
          // A user was created, create the stream user.
          await this.chatService.createStreamChatUsers([result]);
        }
      }
      return result;
    });
  }
}