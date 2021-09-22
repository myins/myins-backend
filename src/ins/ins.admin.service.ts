import { UserRole } from '.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ChatService } from 'src/chat/chat.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsService } from './ins.service';

@Injectable()
export class InsAdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly insService: InsService,
    private readonly chatService: ChatService,
  ) {}

  async changeAdmin(insId: string, newAdminId: string) {
    const notInIns = !(await this.insService.getConnection(newAdminId, insId));
    if (notInIns) {
      throw new BadRequestException("Can't set a non-member as admin!");
    }
    await this.prismaService.$transaction([
      this.prismaService.userInsConnection.updateMany({
        where: {
          role: UserRole.ADMIN,
        },
        data: {
          role: UserRole.MEMBER,
        },
      }),
      this.prismaService.userInsConnection.update({
        where: {
          userId_insId: {
            userId: newAdminId,
            insId: insId,
          },
        },
        data: {
          role: UserRole.ADMIN,
        },
      }),
    ]);
  }

  async removeMember(insId: string, removeMemberId: string) {
    await this.prismaService.userInsConnection.delete({
      where: {
        userId_insId: {
          userId: removeMemberId,
          insId: insId,
        },
      },
    });
  }

  async deleteINS(insId: string) {
    await this.prismaService.iNS.delete({
      where: {
        id: insId,
      },
    });
  }

  async isAdmin(userId: string, insId: string) {
    const connection = await this.insService.getConnection(userId, insId);
    return connection?.role === UserRole.ADMIN;
  }
}
