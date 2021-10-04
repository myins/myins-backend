import { BadRequestException, Injectable } from '@nestjs/common';
import { CommentService } from 'src/comment/comment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import {
  CommentWithPostWithInsesID,
  CommentWithPostWithInsesInclude,
} from 'src/util/prisma-queries-helper';

@Injectable()
export class InsInteractionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly commentService: CommentService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async interact(userId: string, insId: string) {
    await this.prismaService.userInsConnection.update({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }

  async interactPost(userId: string, postId: string) {
    const postWithIns = await this.prismaService.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        inses: {
          select: {
            id: true,
          },
        },
      },
    });
    if (!postWithIns) {
      throw new BadRequestException('Invalid post ID!');
    }
    const insIDs = postWithIns.inses.map((each) => each.id);
    return this.prismaService.userInsConnection.updateMany({
      where: {
        insId: {
          in: insIDs,
        },
        userId: userId,
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }

  async interactComment(userId: string, commentId: string) {
    const postWithIns = await this.commentService.comment(
      {
        id: commentId,
      },
      CommentWithPostWithInsesInclude,
    );
    if (!postWithIns) {
      throw new BadRequestException('Invalid post ID!');
    }
    const insIDs = (<CommentWithPostWithInsesID>postWithIns).post.inses.map(
      (each) => each.id,
    );
    return this.userConnectionService.updateMany({
      where: {
        insId: {
          in: insIDs,
        },
        userId: userId,
      },
      data: {
        interactions: {
          increment: 1,
        },
      },
    });
  }
}
