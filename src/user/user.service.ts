import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  User,
  Prisma,
  UserRole,
  NotificationSource,
  INS,
  UserInsConnection,
} from '@prisma/client';
import { omit } from 'src/util/omit';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { SmsService } from 'src/sms/sms.service';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { UserConnectionService } from './user.connection.service';
import {
  EnableDisableByometryAPI,
  EnableDisableNotificationAPI,
} from './user-api.entity';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: SjwtService,
    private readonly smsService: SmsService,
    private readonly chatService: ChatService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async user(
    where: Prisma.UserWhereUniqueInput,
    include?: Prisma.UserInclude,
    select?: Prisma.UserSelect,
  ): Promise<User | null> {
    const data: Prisma.UserFindUniqueArgs = {
      where,
    };
    if (include) {
      data.include = include;
    }
    if (select) {
      data.select = select;
    }
    return this.prisma.user.findUnique(data);
  }

  async shallowUser(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return this.user(where, undefined, ShallowUserSelect);
  }

  async getUserProfile(userID: string, asUserID?: string) {
    const userModel = await this.user(
      { id: userID },
      {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    );
    if (!userModel) {
      this.logger.error(`Could not find user ${userID}!`);
      throw new NotFoundException('Could not find user!');
    }

    this.logger.log(
      `Creating stream user if not exists for user ${userModel.id}`,
    );
    await this.chatService.createOrUpdateStreamUsers([userModel]);

    let toRet = { ...omit(userModel, 'password', 'refreshToken', 'pushToken') };
    if (userID === asUserID) {
      toRet = {
        ...toRet,
        ...{
          cloudfrontToken: this.getCloudfrontToken('', asUserID),
        },
      };
    }
    const isOwnProfile = !asUserID || userID === asUserID;
    if (isOwnProfile) {
      let streamChatToken = '';
      try {
        streamChatToken = this.chatService.createStreamChatToken(userID);
      } catch (err) {
        const stringErr: string = <string>err;
        this.logger.error(
          `Error generating stream chat token! Chat will not work! + ${stringErr}`,
        );
      }
      toRet = {
        ...toRet,
        ...{
          streamChatToken: streamChatToken,
        },
      };
    }
    return toRet;
  }

  async users(params: Prisma.UserFindManyArgs) {
    const users = await this.prisma.user.findMany(params);
    const usersWithoutImportantFields = users.map((user) => {
      return { ...omit(user, 'password', 'refreshToken', 'pushToken') };
    });
    return usersWithoutImportantFields;
  }

  async shallowUsers(params: Prisma.UserFindManyArgs) {
    params.select = ShallowUserSelect;
    return this.users(params);
  }

  async createUser(data: Prisma.UserCreateInput, inses: INS[]) {
    const newUserModel = await this.prisma.user.create({
      data,
    });

    this.logger.log(`Generating token for user ${newUserModel.id}`);
    const authTokens = await this.jwtService.generateNewAuthTokens(
      newUserModel.phoneNumber,
      newUserModel.id,
    );

    // Get the new user profile, this includes following counts, etc.
    this.logger.log(`Getting profile for user ${newUserModel.id}`);
    const newUserProfile = await this.getUserProfile(newUserModel.id);
    const addedTogether = {
      ...newUserProfile,
      ...authTokens,
    };

    if (data.pushToken) {
      this.logger.log(
        `Updating device token for user stream ${addedTogether.id}`,
      );
      await this.chatService.updateDeviceToken(
        addedTogether.id,
        null,
        data.pushToken,
      );
    }

    this.logger.log('Sending verification code');
    this.smsService.sendVerificationCode(newUserModel);

    if (inses.length) {
      this.logger.log(
        `Adding new user ${addedTogether.id} in inses ${inses.map(
          (ins) => ins.id,
        )}`,
      );
      await this.insService.addInvitedExternalUserIntoINSes(
        inses,
        newUserProfile.id,
        newUserProfile.phoneNumber,
      );
    }

    this.logger.log(`User created ${addedTogether.id}`);
    return addedTogether;
  }

  async updateUser(params: Prisma.UserUpdateArgs): Promise<User> {
    return this.prisma.user.update(params);
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }

  async logoutUser(user: User): Promise<User> {
    this.logger.log(`Updating device token for user stream ${user.id}`);
    await this.chatService.updateDeviceToken(user.id, user.pushToken, null);

    this.logger.log(`Updating user ${user.id}. Removing tokens`);
    return this.updateUser({
      where: {
        id: user.id,
      },
      data: {
        refreshToken: null,
        pushToken: null,
      },
    });
  }

  async approveUser(userId: string, insId: string) {
    await this.userConnectionService.update({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
      data: {
        role: UserRole.MEMBER,
      },
    });

    this.logger.log(
      `Creating notification for joining ins ${insId} by user ${userId}`,
    );

    const targetIDs = (
      await this.userConnectionService.getConnections({
        where: {
          insId: {
            in: insId,
          },
          role: {
            not: UserRole.PENDING,
          },
        },
      })
    ).map((connection) => {
      return { id: connection.userId };
    });

    await this.notificationService.createNotification({
      source: NotificationSource.JOINED_INS,
      targets: {
        connect: targetIDs,
      },
      author: {
        connect: {
          id: userId,
        },
      },
      ins: {
        connect: {
          id: insId,
        },
      },
    });

    this.logger.log(
      `Adding stream user ${userId} as members in channel ${insId}`,
    );
    await this.chatService.addMembersToChannel([userId], insId);
  }

  async denyUser(
    id: string,
    userId: string,
    insId: string,
  ): Promise<UserInsConnection> {
    if (id === userId) {
      this.logger.log(`Removing pending member ${id} from ins ${insId}`);
      return this.userConnectionService.removeMember({
        userId_insId: {
          insId: insId,
          userId: id,
        },
      });
    } else {
      const updatedMemberConnection = await this.userConnectionService.update({
        where: {
          userId_insId: {
            userId: userId,
            insId: insId,
          },
        },
        data: {
          deniedByUsers: {
            push: id,
          },
        },
      });

      this.logger.log(
        `Checking if member ${userId} is denied by all users from ins ${insId}`,
      );
      const connections = await this.userConnectionService.getConnections({
        where: {
          insId: insId,
          role: {
            not: UserRole.PENDING,
          },
          user: {
            isDeleted: false,
          },
        },
      });
      const noDenyMembers = connections.find(
        (connection) =>
          !updatedMemberConnection.deniedByUsers.includes(connection.userId),
      );

      if (!noDenyMembers) {
        this.logger.log(`Removing pending member ${userId} from ins ${insId}`);
        const ret = await this.userConnectionService.removeMember({
          userId_insId: {
            insId: insId,
            userId: userId,
          },
        });

        this.logger.log(
          `Creating notification for decining user ${userId} from ins ${insId}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.JOIN_INS_REJECTED,
          targets: {
            connect: {
              id: userId,
            },
          },
          author: {
            connect: {
              id: userId,
            },
          },
          ins: {
            connect: {
              id: insId,
            },
          },
        });

        return ret;
      }

      return updatedMemberConnection;
    }
  }

  async setLastReadNotificationID(
    userID: string,
    notifID: string,
  ): Promise<User> {
    this.logger.log(
      `Updating user ${userID}. Set last notification ${notifID}`,
    );
    return this.updateUser({
      where: {
        id: userID,
      },
      data: {
        lastReadNotification: new Date(),
      },
    });
  }

  async changeDisabledNotifications(
    user: User,
    data: EnableDisableNotificationAPI,
    disable: boolean,
  ): Promise<User> {
    const { sources, all } = data;
    this.logger.log(
      `Updating user ${user.id}. Change disabled notifications for ${
        all ? 'all sources' : 'sources ' + sources
      }. Set to ${disable}`,
    );

    const disableNotificationsValue = disable
      ? all
        ? {
            push: <NotificationSource[]>(
              Object.keys(NotificationSource).filter(
                (source) =>
                  !user.disabledNotifications.includes(
                    <NotificationSource>source,
                  ),
              )
            ),
          }
        : {
            push: sources.filter(
              (source) =>
                !user.disabledNotifications.includes(
                  <NotificationSource>source,
                ),
            ),
          }
      : all
      ? []
      : user.disabledNotifications.filter(
          (notifSource) => !sources.includes(notifSource),
        );

    if (all || sources.includes(NotificationSource.MESSAGE)) {
      if (disable) {
        this.logger.log(
          `Removing all devices tokens for user stream ${user.id}`,
        );
        await this.chatService.removeAllDevices(user.id);
      } else {
        this.logger.log(`Updating device token for user stream ${user.id}`);
        await this.chatService.updateDeviceToken(user.id, null, user.pushToken);
      }
    }

    return this.updateUser({
      where: {
        id: user.id,
      },
      data: {
        disabledNotifications: disableNotificationsValue,
      },
    });
  }

  async changeDisabledByometrics(
    user: User,
    data: EnableDisableByometryAPI,
    disable: boolean,
  ): Promise<User> {
    const { insID, all } = data;
    this.logger.log(
      `Updating user ${user.id}. Change disabled byometrics. ${
        disable ? 'Disable' : 'Enable'
      } ${all ? 'all' : 'for ins ' + insID}`,
    );

    if (all) {
      return this.updateUser({
        where: {
          id: user.id,
        },
        data: {
          disabledAllBiometry: disable,
          disabledBiometryINSIds: [],
        },
      });
    }

    const enableINSIdValue = user.disabledAllBiometry
      ? (
          await this.insService.inses({
            where: {
              members: {
                some: {
                  userId: user.id,
                  role: {
                    not: UserRole.PENDING,
                  },
                },
              },
              id: {
                not: insID,
              },
            },
          })
        ).map((ins) => ins.id)
      : user.disabledBiometryINSIds.filter(
          (byometryInsID) => byometryInsID !== insID,
        );

    const disableByometricsValue = disable
      ? {
          push: !user.disabledBiometryINSIds.includes(insID) ? insID : [],
        }
      : enableINSIdValue;

    return this.updateUser({
      where: {
        id: user.id,
      },
      data: {
        disabledAllBiometry:
          !disable && user.disabledAllBiometry
            ? false
            : user.disabledAllBiometry,
        disabledBiometryINSIds: disableByometricsValue,
      },
    });
  }

  getCloudfrontToken(phone: string, userID: string): string {
    return this.jwtService.getCloudfrontToken({ phone, sub: userID });
  }
}
