import { Prisma } from '.prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MediaConnectionsService {
  private readonly logger = new Logger(MediaConnectionsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getViews(params: Prisma.UserStoryMediaViewConnectionFindManyArgs) {
    return this.prismaService.userStoryMediaViewConnection.findMany(params);
  }

  async getLikes(params: Prisma.UserStoryMediaLikeConnectionFindManyArgs) {
    return this.prismaService.userStoryMediaLikeConnection.findMany(params);
  }
}
