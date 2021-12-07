import { Injectable } from '@nestjs/common';
import { Prisma, UserPostLikeConnection } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostLikeService {
  constructor(private readonly prisma: PrismaService) {}

  async postLikes(
    params: Prisma.UserPostLikeConnectionFindManyArgs,
  ): Promise<UserPostLikeConnection[]> {
    return this.prisma.userPostLikeConnection.findMany(params);
  }

  async deleteLike(where: Prisma.UserPostLikeConnectionWhereUniqueInput) {
    return this.prisma.userPostLikeConnection.delete({ where });
  }
}
