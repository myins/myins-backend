import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { SmsService } from 'src/sms/sms.service';
import { UserService } from 'src/user/user.service';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';

@Injectable()
export class InviteService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    private readonly chatService: ChatService,
    private readonly insService: InsService,
  ) {}

  async inviteExternalUser(
    userID: string,
    phoneNumbers: string[],
    ins: string,
  ) {
    const connection = await this.insService.getConnection(userID, ins);
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

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
      await this.insService.addAsInvitedPhoneNumbers(
        theINS[0].id,
        otherUsersPhoneNumbers,
      );
    }
  }

  async inviteINSUser(userID: string, otherUsers: string[], ins: string) {
    const connection = await this.insService.getConnection(userID, ins);
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

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
      // after implement pendingMembers, here the role will be changed to UserRole.PENDING and
      // the addMembersToChannel from line 139 will be moved to approve user function from user service
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
    await this.chatService.addMembersToChannel(otherUsers, theINS[0].id);
  }

  async invitesList(
    all: boolean,
    skip: number,
    take: number,
    search: string,
    userID: string,
    insID: string,
  ) {
    const theINS = await this.prismaService.iNS.findUnique({
      where: {
        id: insID,
      },
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (
      !theINS ||
      theINS.members.findIndex((each) => each.userId == userID) == -1
    ) {
      throw new NotFoundException('Could not find that INS!');
    }

    const profileInfo: Prisma.UserWhereInput = {
      OR:
        search && search.length > 0
          ? [
              {
                firstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      id: {
        not: {
          in: theINS.members.map((each) => each.userId),
        },
      },
      inses: all
        ? undefined
        : {
            some: {
              ins: {
                members: {
                  some: {
                    userId: userID,
                  },
                },
              },
            },
          },
    };

    const toRet = await this.userService.shallowUsers({
      where: profileInfo,
      orderBy: [
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      skip: skip,
      take: take,
    });
    return toRet;
  }
}
