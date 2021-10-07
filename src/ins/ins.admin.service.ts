import { INS, Prisma, UserRole } from '.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserConnectionService } from 'src/user/user.connection.service';

@Injectable()
export class InsAdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async changeAdmin(insId: string, newAdminId: string) {
    const notInIns = !(await this.userConnectionService.getConnection({
      userId_insId: {
        userId: newAdminId,
        insId: insId,
      },
    }));
    if (notInIns) {
      throw new BadRequestException("Can't set a non-member as admin!");
    }
    return this.userConnectionService.changeAdmin(insId, newAdminId);
  }

  async deleteINS(where: Prisma.INSWhereUniqueInput): Promise<INS> {
    return this.prismaService.iNS.delete({
      where,
    });
  }

  async isAdmin(userId: string, insId: string): Promise<boolean> {
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: userId,
        insId: insId,
      },
    });
    return connection?.role === UserRole.ADMIN;
  }
}
