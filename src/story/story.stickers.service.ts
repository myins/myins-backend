import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StoryStickersService {
  private readonly logger = new Logger(StoryStickersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMany(data: Prisma.StoryStickersCreateManyInput[]) {
    return this.prisma.storyStickers.createMany({ data });
  }
}
