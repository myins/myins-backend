import { Prisma } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostConnectionService {
  constructor(private readonly prismaService: PrismaService) {}

  async get(where: Prisma.PostInsConnectionWhereUniqueInput) {
    return this.prismaService.postInsConnection.findUnique({ where });
  }

  async update(params: Prisma.PostInsConnectionUpdateArgs) {
    return this.prismaService.postInsConnection.update(params);
  }

  async delete(where: Prisma.PostInsConnectionWhereUniqueInput) {
    return this.prismaService.postInsConnection.delete({ where });
  }
}
