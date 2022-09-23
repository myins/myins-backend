import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AnalyticsType,
  INS,
  NotificationSource,
  Prisma,
  UserInsConnection,
  UserRole,
} from '@prisma/client';
import { SmsService } from 'src/sms/sms.service';
import { UserService } from 'src/user/user.service';
import { InsService } from 'src/ins/ins.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import {
  NotificationPushService,
  PushExtraNotification,
  PushNotificationSource,
} from 'src/notification/notification.push.service';
import { NotificationService } from 'src/notification/notification.service';
import { isProd } from 'src/util/checks';
import { AnalyticsService } from 'src/analytics/analytics.service';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
    private readonly notificationService: NotificationService,
    private readonly notificationPushService: NotificationPushService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async inviteExternalUser(
    userID: string,
    phoneNumbers: string[],
    ins: string,
  ) {
    const connection = await this.userConnectionService.getNotPendingConnection(
      {
        userId_insId: {
          userId: userID,
          insId: ins,
        },
      },
    );
    if (!connection) {
      this.logger.error("You're not allowed to approve members for this INS!");
      throw new BadRequestException(
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
      this.logger.error('Could not find that INS!');
      throw new NotFoundException('Could not find that INS!');
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
        `Sending invitation by sms for phone numbers ${otherUsersPhoneNumbers} for inviting in ins ${ins} by user ${userID}`,
      );
      await Promise.all(
        otherUsersPhoneNumbers.map(async (otherUserPhoneNumer) => {
          await this.smsService.sendSMS(
            otherUserPhoneNumer,
            `You've been invited to MyINS! Click this link to get the app: ${
              isProd()
                ? process.env.SHARE_LINK_URL
                : 'https://myinsdevelop.page.link'
            }/${theINS[0].shareCode}`,
          );
        }),
      );

      this.logger.log(
        `Adding phone numbers ${otherUsersPhoneNumbers} as invited phone numbers for ins ${theINS[0].id}`,
      );
      await this.insService.addAsInvitedPhoneNumbers(
        theINS[0].id,
        otherUsersPhoneNumbers,
      );

      this.logger.log(`Adding analytic because inviting non users`);
      await this.analyticsService.createAnalytic({
        type: AnalyticsType.INVITE_NON_USER,
        count: otherUsersPhoneNumbers.length,
      });
    }
  }

  async inviteINSUser(userID: string, otherUsers: string[], ins: string) {
    const connection = await this.userConnectionService.getNotPendingConnection(
      {
        userId_insId: {
          userId: userID,
          insId: ins,
        },
      },
    );
    if (!connection) {
      this.logger.error("You're not allowed to invite members in this INS!");
      throw new BadRequestException(
        "You're not allowed to invite members in this INS!",
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
      this.logger.error('Could not find that INS!');
      throw new NotFoundException('Could not find that INS!');
    }

    const castedINS = <
      INS & {
        members: UserInsConnection[];
      }
    >theINS[0];
    if (castedINS.members.length === otherUsers.length) {
      this.logger.error('All users are already in that INS!');
      throw new BadRequestException('All users are already in that INS!');
    }

    const memberIDs = castedINS.members.map((member) => member.userId);
    const usersNotInINS = otherUsers.filter(
      (otherUser) => !memberIDs.includes(otherUser),
    );
    const data = usersNotInINS.map((otherUser) => ({
      userId: otherUser,
      role: UserRole.PENDING,
      invitedBy: userID,
    }));

    this.logger.log(
      `Update ins ${castedINS.id}. Adding pending members ${usersNotInINS}`,
    );
    await this.insService.update({
      where: {
        id: castedINS.id,
      },
      data: {
        members: {
          createMany: {
            data: data,
          },
        },
      },
    });

    await Promise.all(
      data.map(async (dataCreate) => {
        this.logger.log(
          `Creating push notification for requesting access in ins ${castedINS.id}`,
        );
        const dataPush: PushExtraNotification = {
          source: PushNotificationSource.REQUEST_FOR_ME,
          author: await this.userService.shallowUser({ id: userID }),
          ins: castedINS,
          targets: [dataCreate.userId],
        };
        await this.notificationPushService.pushNotification(dataPush);
      }),
    );

    setTimeout(async () => {
      await Promise.all(
        data.map(async (dataCreate) => {
          this.logger.log(
            `Creating notification for pending ins ${castedINS.id} for user ${dataCreate.userId}`,
          );
          await this.notificationService.createNotification({
            source: NotificationSource.PENDING_INS,
            targets: {
              connect: { id: dataCreate.userId },
            },
            author: {
              connect: { id: dataCreate.userId },
            },
            ins: {
              connect: {
                id: castedINS.id,
              },
            },
          });
        }),
      );
    }, 2000);

    this.logger.log(`Adding analytic because inviting myins users`);
    await this.analyticsService.createAnalytic({
      type: AnalyticsType.INVITE_MYINS_USER,
      count: data.length,
    });
  }

  async invitesList(
    all: boolean,
    skip: number,
    take: number,
    search: string,
    userID: string,
    insID: string,
  ) {
    const theINS = await this.insService.ins(
      {
        id: insID,
      },
      {
        members: {
          select: {
            userId: true,
          },
        },
      },
    );

    const castedINS = <
      INS & {
        members: UserInsConnection[];
      }
    >theINS;
    if (
      !castedINS ||
      castedINS.members.findIndex((each) => each.userId == userID) == -1
    ) {
      this.logger.error('Could not find that INS!');
      throw new NotFoundException('Could not find that INS!');
    }

    if (all && !search.length) {
      return [];
    }

    const profileInfo: Prisma.UserWhereInput = {
      OR:
        search && search.length
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
          in: castedINS.members.map((each) => each.userId),
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
      isDeleted: false,
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
