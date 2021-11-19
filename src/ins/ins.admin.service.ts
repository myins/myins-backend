import { INS, Prisma, UserRole } from '.prisma/client';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserConnectionService } from 'src/user/user.connection.service';

@Injectable()
export class InsAdminService {
  private readonly logger = new Logger(InsAdminService.name);

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
      this.logger.error("Can't set a non-member as admin!");
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
    if (!connection) {
      this.logger.error("You're not a member of this ins!");
      throw new BadRequestException("You're not a member of this ins!");
    }
    return connection?.role === UserRole.ADMIN;
  }
}
