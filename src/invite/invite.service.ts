import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { SmsService } from 'src/sms/sms.service';
import { UserService } from 'src/user/user.service';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import {
  InsWithMembersID,
  InsWithMembersIDInclude,
} from 'src/prisma-queries-helper/ins-include-member-id';
import {
  InsWithMembersInUserIDs,
  InsWithMembersInUserIDsInclude,
} from 'src/prisma-queries-helper/ins-include-members-in-user-ids';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    private readonly chatService: ChatService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async inviteExternalUser(
    userID: string,
    phoneNumbers: string[],
    ins: string,
  ) {
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: userID,
        insId: ins,
      },
    });
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

    const theINS = await this.insService.inses({
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
      this.logger.log(
        `Inviting users that already exists ${existedUsers.map(
          (user) => user.id,
        )} in ins ${ins} by user ${userID}`,
      );
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
      this.logger.log(
        `Sending invitation by sms for phones ${otherUsersPhoneNumbers} for inviting in ins ${ins} by user ${userID}`,
      );
      await Promise.all(
        otherUsersPhoneNumbers.map(async (otherUserPhoneNumer) => {
          await this.smsService.sendSMS(
            otherUserPhoneNumer,
            `You've been invited to MyINS! Click this link to get the app: https://myins.com/join/${theINS[0].shareCode}`,
          );
        }),
      );

      this.logger.log(
        `Adding phones ${otherUsersPhoneNumbers} as invited phone numbers for ins ${theINS[0].id}`,
      );
      await this.insService.addAsInvitedPhoneNumbers(
        theINS[0].id,
        otherUsersPhoneNumbers,
      );
    }
  }

  async inviteINSUser(userID: string, otherUsers: string[], ins: string) {
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: userID,
        insId: ins,
      },
    });
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

    const theINS = await this.insService.inses({
      where: {
        id: ins,
        members: {
          some: {
            userId: userID,
          },
        },
      },
      include: InsWithMembersInUserIDsInclude(otherUsers),
    });

    if (!theINS.length) {
      throw new BadRequestException('Could not find that INS!');
    }
    if (
      (<InsWithMembersInUserIDs>theINS[0]).members.length === otherUsers.length
    ) {
      throw new BadRequestException('All users are already in that INS!');
    }

    const memberIDs = (<InsWithMembersInUserIDs>theINS[0]).members.map(
      (member) => member.userId,
    );
    const usersNotInINS = otherUsers.filter(
      (otherUser) => !memberIDs.includes(otherUser),
    );
    const data = usersNotInINS.map((otherUser) => ({
      userId: otherUser,
      // after implement pendingMembers, here the role will be changed to UserRole.PENDING and
      // the addMembersToChannel from line 139 will be moved to approve user function from user service
      role: UserRole.MEMBER,
    }));

    this.logger.log(
      `Update ins ${theINS[0].id}. Adding members ${usersNotInINS}`,
    );
    await this.insService.update({
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

    this.logger.log(
      `Adding stream users ${otherUsers} as members in channel ${theINS[0].id}`,
    );
    await this.chatService.addMembersToChannel(otherUsers, theINS[0].id);
  }

  async invitesList(
    all: boolean,
    skip: number,
    take: number,
    search: string,
    userID: string,
    insID: string,
  ): Promise<User[]> {
    const theINS = await this.insService.ins(
      {
        id: insID,
      },
      InsWithMembersIDInclude,
    );

    if (
      !theINS ||
      (<InsWithMembersID>theINS).members.findIndex(
        (each) => each.userId == userID,
      ) == -1
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
          in: (<InsWithMembersID>theINS).members.map((each) => each.userId),
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

    this.logger.log('Getting shallow users');
    return this.userService.shallowUsers({
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
  }
}
