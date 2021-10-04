import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMany(
    params: Prisma.UserInsConnectionUpdateManyArgs,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.userInsConnection.updateMany(params);
  }
}
