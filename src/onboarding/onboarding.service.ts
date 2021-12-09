import { UserRole } from '.prisma/client';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly chatService: ChatService,
    private readonly insService: InsService,
    private readonly postService: PostService,
  ) {}

  @Cron('0 1 * * *')
  async removeOldINS() {
    this.logger.log('[Cron] Removing old unclaimed INSes..');
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
    this.logger.log(`[Cron] Cleaned up ${res.count} unclaimed INSes!`);
  }

  async claimINS(insID: string, userID: string) {
    const ins = await this.insService.ins(
      {
        id: insID,
      },
      InsWithCountMembersInclude,
    );
    if (!ins || (<InsWithCountMembers>ins)._count?.members != 0) {
      this.logger.error(`Could not find INS ${insID}!`);
      throw new NotFoundException('Could not find INS!');
    }

    // Firstly, we want to create the chat channel

    this.logger.log(`Create channel for ins ${insID} by user stream ${userID}`);
    await this.chatService.createChannelINS(ins, userID);
    await this.prismaService.$transaction(async () => {
      // First we connect the user to that INS
      this.logger.log(`Updating ins ${insID}. Adding user ${userID} as admin`);
      await this.insService.update({
        where: {
          id: insID,
        },
        data: {
          members: {
            create: {
              userId: userID,
              role: UserRole.ADMIN,
            },
          },
        },
      });

      //Then we also make him the owner of all the posts (should be one post)
      this.logger.log(
        `Updating posts for ins ${insID}. Adding user ${userID} as author`,
      );
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
  }
}
