import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InsInteractionService {
  constructor(private readonly prismaService: PrismaService) {}

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
    const postWithIns = await this.prismaService.comment.findUnique({
      where: {
        id: commentId,
      },
      include: {
        post: {
          select: {
            inses: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
    if (!postWithIns) {
      throw new BadRequestException('Invalid post ID!');
    }
    const insIDs = postWithIns.post.inses.map((each) => each.id);
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
}
