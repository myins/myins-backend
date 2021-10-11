import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { PostService } from 'src/post/post.service';
import {
  InsWithCountMembers,
  InsWithCountMembersInclude,
} from 'src/prisma-queries-helper/ins-include-count-members';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly chatService: ChatService,
    private readonly insService: InsService,
    private readonly postService: PostService,
  ) {}

  private readonly logger = new Logger(OnboardingService.name);

  @Cron('0 1 * * *')
  async removeOldINS() {
    this.logger.log('Removing old unclaimed INSes..');
    const d = new Date();
    d.setDate(d.getDate() - 2);

    const res = await this.insService.deleteMany({
      where: {
        members: {
          none: {},
        },
        createdAt: {
          lt: d,
        },
      },
    });
    this.logger.log(`Cleaned up ${res.count} unclaimed INSes!`);
  }

  async claimINS(insID: string, userID: string) {
    const ins = await this.insService.ins(
      {
        id: insID,
      },
      InsWithCountMembersInclude,
    );
    if (!ins || (<InsWithCountMembers>ins)._count?.members != 0) {
      throw new BadRequestException('Could not find INS!');
    }

    // Firstly, we want to create the chat channel

    await this.chatService.createChannelINS(ins, userID);
    await this.prismaService.$transaction(async () => {
      // First we connect the user to that INS
      await this.insService.update({
        where: {
          id: insID,
        },
        data: {
          members: {
            create: {
              userId: userID,
              role: 'ADMIN',
            },
          },
        },
      });
      //Then we also make him the owner of all the posts (should be one post)
      await this.postService.updateManyPosts({
        where: {
          inses: {
            some: {
              id: ins.id,
            },
          },
          authorId: null,
        },
        data: {
          authorId: userID,
        },
      });
    });
    const posts = await this.postService.posts({
      where: {
        inses: {
          some: {
            id: ins.id,
          },
        },
        authorId: userID,
      },
    });
    await Promise.all(
      posts.map(async (post) => {
        if (post.authorId) {
          await this.chatService.sendMessageWhenPost(
            [insID],
            post.authorId,
            post.id,
            post.content,
          );
        }
      }),
    );
  }
}
