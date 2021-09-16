import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { SmsService } from 'src/sms/sms.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class InviteService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
  ) {}

  async inviteExternalUser(
    userID: string,
    otherUserPhoneNumber: string,
    ins: string,
  ) {
    const theINS = await this.prismaService.iNS.findMany({
      where: {
        id: ins,
        members: {
          some: {
            userId: userID,
          },
        },
      },
    });

    if (!theINS.length) {
      throw new BadRequestException('Could not find that INS!');
    }

    const otherUser = await this.userService.user({
      phoneNumber: otherUserPhoneNumber,
    });
    if (otherUser) {
      await this.inviteINSUser(userID, otherUser.id, ins);
    } else {
      await this.smsService.sendSMS(
        otherUserPhoneNumber,
        `You've been invited to MyINS! Click this link to get the app: https://myins.com/join/${theINS[0].shareCode}`,
      );
    }
  }

  async inviteINSUser(userID: string, otherUser: string, ins: string) {
    const theINS = await this.prismaService.iNS.findMany({
      where: {
        id: ins,
        members: {
          some: {
            userId: userID,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: otherUser,
          },
        },
      },
    });

    if (!theINS.length) {
      throw new BadRequestException('Could not find that INS!');
    }
    if (theINS[0].members.length > 0) {
      throw new BadRequestException('The user is already in that INS!');
    }

    await this.prismaService.iNS.update({
      where: {
        id: theINS[0].id,
      },
      data: {
        members: {
          create: {
            userId: otherUser,
            role: UserRole.PENDING,
          },
        },
      },
    });
  }
}
