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
    phoneNumbers: string[],
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

    const existedUsers = await this.userService.users({
      where: {
        phoneNumber: {
          in: phoneNumbers,
        },
      },
    });
    if (existedUsers.length) {
      await this.inviteINSUser(
        userID,
        existedUsers.map((user) => user.id),
        ins,
      );
    }

    const existedPhoneNumbers = existedUsers.map((user) => user.phoneNumber);
    const otherUsersPhoneNumbers = phoneNumbers.filter(
      (phoneNumber) => !existedPhoneNumbers.includes(phoneNumber),
    );
    if (otherUsersPhoneNumbers.length) {
      //FIXME: look into integrating twilio mass messaging tool to avoid multiple api calls
      await Promise.all(
        otherUsersPhoneNumbers.map(async (otherUserPhoneNumer) => {
          await this.smsService.sendSMS(
            otherUserPhoneNumer,
            `You've been invited to MyINS! Click this link to get the app: https://myins.com/join/${theINS[0].shareCode}`,
          );
        }),
      );
    }
  }

  async inviteINSUser(userID: string, otherUsers: string[], ins: string) {
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
            userId: {
              in: otherUsers,
            },
          },
        },
      },
    });

    if (!theINS.length) {
      throw new BadRequestException('Could not find that INS!');
    }
    if (theINS[0].members.length === otherUsers.length) {
      throw new BadRequestException('All users are already in that INS!');
    }

    const memberIDs = theINS[0].members.map((member) => member.userId);
    const usersNotInINS = otherUsers.filter(
      (otherUser) => !memberIDs.includes(otherUser),
    );
    const data = usersNotInINS.map((otherUser) => ({
      userId: otherUser,
      role: UserRole.MEMBER,
    }));
    await this.prismaService.iNS.update({
      where: {
        id: theINS[0].id,
      },
      data: {
        members: {
          createMany: {
            data: data,
          },
        },
      },
    });
  }
}
