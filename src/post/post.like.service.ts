import { Injectable } from '@nestjs/common';
import { Prisma, UserPostLikeConnection } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostLikeService {
  constructor(private readonly prisma: PrismaService) {}

  async postLikes(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserPostLikeConnectionWhereInput;
    orderBy?: Prisma.UserPostLikeConnectionOrderByWithRelationInput;
    include?: Prisma.UserPostLikeConnectionInclude;
  }): Promise<UserPostLikeConnection[]> {
    const { skip, take, where, orderBy, include } = params;
    return this.prisma.userPostLikeConnection.findMany({
      skip,
      take,
      where,
      orderBy,
      include,
    });
  }
}
