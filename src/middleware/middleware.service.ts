import { INS, Post, User, UserInsConnection } from '.prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MiddlewareService {
  private readonly logger = new Logger(MiddlewareService.name);

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
          this.logger.log(
            `Delete ins ${result.id} => delete channel ${result.id}`,
          );
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
            this.logger.log(
              `Create ins ${insResult.id} with owner ${createdOwnerID} => create channel ${insResult.id} by user stream ${createdOwnerID}`,
            );
            await this.chatService.createChannelINS(insResult, createdOwnerID);
          }
        }
        if (params.action == 'update') {
          const insResult = <INS>result;
          const channels = await chatService.getChannelsINS({
            id: insResult.id,
          });
          if (channels.length) {
            this.logger.log(
              `Update ins ${insResult.id} => update channel ${insResult.id}`,
            );
            await channels[0].update({
              name: insResult.name,
              image: insResult.cover,
              insChannel: true,
            });
          }
        }
      }
      return result;
    });

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);

      if (params.model == 'UserInsConnection') {
        if (params.action == 'createMany') {
          this.logger.log(
            `Add user ${
              params.args.data[0].userId
            } to inses ${params.args.data.map(
              (userInsConnection: { userId: string; insId: string }) =>
                userInsConnection.insId,
            )} => add user stream ${
              params.args.data[0].userId
            } to channels ${params.args.data.map(
              (userInsConnection: { userId: string; insId: string }) =>
                userInsConnection.insId,
            )}`,
          );
          await Promise.all(
            params.args.data.map(
              async (userInsConnection: { userId: string; insId: string }) => {
                await chatService.addMembersToChannel(
                  [userInsConnection.userId],
                  userInsConnection.insId,
                );
              },
            ),
          );
        } else if (params.action == 'delete') {
          // A user left an INS, remove them from the channel.
          const userInsResult = <UserInsConnection>result;
          this.logger.log(
            `Remove user ${userInsResult.userId} from ins ${userInsResult.insId} => remove user stream ${userInsResult.userId} from channel ${userInsResult.insId}`,
          );
          await this.chatService.removeMemberFromChannel(
            userInsResult.userId,
            userInsResult.insId,
          );
        }
      }

      return result;
    });

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);
      if (params.model == 'User') {
        if (params.action == 'delete') {
          // A user was deleted, remove them from stream.
          this.logger.log(
            `Delete user ${result.id} => delete user stream ${result.id}`,
          );
          await this.chatService.deleteStreamUser(result.id);
        } else if (params.action == 'create' || params.action == 'update') {
          // A user was created, create the stream user.
          const userResult = <User>result;
          this.logger.log(
            `${params.action == 'create' ? 'Create' : 'Update'} user ${
              userResult.id
            } => ${params.action} user stream ${userResult.id}`,
          );
          await this.chatService.createOrUpdateStreamUsers([userResult]);
        }
      }
      return result;
    });

    this.prismaService.$use(async (params, next) => {
      const result = await next(params);
      if (params.model == 'Post') {
        if (params.action == 'create') {
          // A post was created, send message to all channels.
          const postResult = <Post>result;
          if (postResult.authorId && params.args.data.inses.connect.length) {
            this.logger.log(
              `Create post ${postResult.id} => send message by ${
                postResult.authorId
              } in inses ${params.args.data.inses.connect.map(
                (ins: { id: string }) => ins.id,
              )} with new posts ${postResult.id}`,
            );
            await this.chatService.sendMessageWhenPost(
              params.args.data.inses.connect.map(
                (ins: { id: string }) => ins.id,
              ),
              postResult.authorId,
              postResult.id,
              postResult.content,
            );
          }
        }
      }
      return result;
    });
  }
}
