import { Injectable } from '@nestjs/common';
import { Prisma, UserInsConnection, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getConnection(
    where: Prisma.UserInsConnectionWhereUniqueInput,
  ): Promise<UserInsConnection | null> {
    return this.prisma.userInsConnection.findUnique({
      where,
    });
  }

  async getConnections(
    params: Prisma.UserInsConnectionFindManyArgs,
  ): Promise<UserInsConnection[]> {
    return this.prisma.userInsConnection.findMany(params);
  }

  async createMany(data: Prisma.UserInsConnectionCreateManyInput[]) {
    return this.prisma.userInsConnection.createMany({ data });
  }

  async updateMany(params: Prisma.UserInsConnectionUpdateManyArgs) {
    return this.prisma.userInsConnection.updateMany(params);
  }

  async update(
    params: Prisma.UserInsConnectionUpdateArgs,
  ): Promise<UserInsConnection> {
    return this.prisma.userInsConnection.update(params);
  }

  async changeAdmin(insId: string, newAdminId: string) {
    return this.prisma.$transaction(async () => {
      await this.updateMany({
        where: {
          role: UserRole.ADMIN,
          insId: insId,
        },
        data: {
          role: UserRole.MEMBER,
        },
      });
      await this.update({
        where: {
          userId_insId: {
            userId: newAdminId,
            insId: insId,
          },
        },
        data: {
          role: UserRole.ADMIN,
        },
      });
    });
  }

  async removeMember(
    where: Prisma.UserInsConnectionWhereUniqueInput,
  ): Promise<UserInsConnection> {
    return this.prisma.userInsConnection.delete({
      where,
    });
  }
}
