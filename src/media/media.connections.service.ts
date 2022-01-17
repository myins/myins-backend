import { Prisma } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MediaConnectionsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getViews(params: Prisma.UserStoryMediaViewConnectionFindManyArgs) {
    return this.prismaService.userStoryMediaViewConnection.findMany(params);
  }

  async getLikes(params: Prisma.UserStoryMediaLikeConnectionFindManyArgs) {
    return this.prismaService.userStoryMediaLikeConnection.findMany(params);
  }

  async countViews(params: Prisma.UserStoryMediaViewConnectionCountArgs) {
    return this.prismaService.userStoryMediaViewConnection.count(params);
  }

  async countLikes(params: Prisma.UserStoryMediaLikeConnectionCountArgs) {
    return this.prismaService.userStoryMediaLikeConnection.count(params);
  }
}
