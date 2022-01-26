import { Prisma } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostConnectionService {
  constructor(private readonly prismaService: PrismaService) {}

  async get(
    where: Prisma.PostInsConnectionWhereUniqueInput,
    include?: Prisma.PostInsConnectionInclude,
  ) {
    return this.prismaService.postInsConnection.findUnique({ where, include });
  }

  async getInsConnections(params: Prisma.PostInsConnectionFindManyArgs) {
    return this.prismaService.postInsConnection.findMany(params);
  }

  async count(params: Prisma.PostInsConnectionCountArgs): Promise<number> {
    return this.prismaService.postInsConnection.count(params);
  }

  async update(params: Prisma.PostInsConnectionUpdateArgs) {
    return this.prismaService.postInsConnection.update(params);
  }

  async delete(
    where: Prisma.PostInsConnectionWhereUniqueInput,
    include?: Prisma.PostInsConnectionInclude,
  ) {
    return this.prismaService.postInsConnection.delete({ where, include });
  }

  async deleteMany(params: Prisma.PostInsConnectionDeleteManyArgs) {
    return this.prismaService.postInsConnection.deleteMany(params);
  }
}
