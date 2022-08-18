import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma, UserInsConnection, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';

@Injectable()
export class UserConnectionService {
  private readonly logger = new Logger(UserConnectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConnection(
    where: Prisma.UserInsConnectionWhereUniqueInput,
  ): Promise<UserInsConnection | null> {
    return this.prisma.userInsConnection.findUnique({
      where,
    });
  }

  async getNotPendingConnection(
    where: Prisma.UserInsConnectionWhereUniqueInput,
  ) {
    const connection = await this.getConnection(where);
    if (connection?.role !== UserRole.PENDING) {
      return connection;
    }
    return null;
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

  async updatePinned(
    userID: string,
    insID: string,
    pinned: boolean,
  ): Promise<UserInsConnection> {
    const connection = await this.getNotPendingConnection({
      userId_insId: {
        userId: userID,
        insId: insID,
      },
    });
    if (!connection) {
      this.logger.error("You're not allowed to do this operation!");
      throw new BadRequestException("You're not allowed to do this operation!");
    }

    this.logger.log(
      `Update connection between user ${userID} and ins ${insID}. Set pinned flag`,
    );
    return this.update({
      where: {
        userId_insId: {
          userId: userID,
          insId: insID,
        },
      },
      data: {
        pinned,
      },
    });
  }

  async count(data: Prisma.UserInsConnectionCountArgs) {
    return this.prisma.userInsConnection.count(data);
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
      return this.update({
        where: {
          userId_insId: {
            userId: newAdminId,
            insId: insId,
          },
        },
        data: {
          role: UserRole.ADMIN,
        },
        select: {
          user: {
            select: ShallowUserSelect,
          },
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

  async removeManyMembers(where: Prisma.UserInsConnectionWhereInput) {
    return this.prisma.userInsConnection.deleteMany({
      where,
    });
  }
}
