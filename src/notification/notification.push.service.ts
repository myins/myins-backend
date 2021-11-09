import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as PushNotifications from 'node-pushnotifications';
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev
import { FirebaseMessagingService } from '@aginix/nestjs-firebase-admin';
import { NotificationSource, Prisma, User, UserRole } from '.prisma/client';
import { UserService } from 'src/user/user.service';
import { InsService } from 'src/ins/ins.service';
import { UserConnectionService } from 'src/user/user.connection.service';

const sandboxSettings = {
  gcm: {
    id: '',
  },
  apn: {
    token: {
      key: process.env['APNS_AUTH_KEY'], // optionally: fs.readFileSync('./certs/key.p8')
      keyId: process.env['APNS_AUTH_KEY_ID'],
      teamId: process.env['APNS_AUTH_KEY_TEAM_ID'],
    },
    production: false, // true for APN production environment, false for APN sandbox environment,
  },
  isAlwaysUseFCM: false, // true all messages will be sent through node-gcm (which actually uses FCM)
};

const prodSettings = {
  gcm: {
    id: '',
  },
  apn: {
    token: {
      key: process.env['APNS_AUTH_KEY'], // optionally: fs.readFileSync('./certs/key.p8')
      keyId: process.env['APNS_AUTH_KEY_ID'],
      teamId: process.env['APNS_AUTH_KEY_TEAM_ID'],
    },
    production: true,
  },
  isAlwaysUseFCM: false,
};

const sandboxPush = new PushNotifications(sandboxSettings);
const prodPush = new PushNotifications(prodSettings);

@Injectable()
export class NotificationPushService {
  private readonly logger = new Logger(NotificationPushService.name);

  constructor(
    private readonly messagingService: FirebaseMessagingService,
    private readonly userService: UserService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async pushNotification(notif: Prisma.NotificationCreateInput) {
    const usersIDs = await this.getUsersIDsBySource(notif);

    await Promise.all(
      usersIDs.map(async (userID) => {
        const target = await this.userService.user({ id: userID });
        if (
          target?.pushToken &&
          !target.disabledNotifications.includes(notif.source)
        ) {
          this.logger.log('Adding push notification');
          const notifBody = await this.constructNotificationBody(target, notif);
          await this.pushData(
            target.pushToken,
            target?.sandboxToken ?? false,
            notifBody,
          );
        }
      }),
    );
  }

  async getUsersIDsBySource(notif: Prisma.NotificationCreateInput) {
    let usersIDs: string[] = [];

    const unreachable = (x: never) => {
      this.logger.error(`This shouldn't be possible! ${x}`);
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (notif.source) {
      case NotificationSource.LIKE_POST:
      case NotificationSource.LIKE_COMMENT:
      case NotificationSource.COMMENT:
      case NotificationSource.JOIN_INS_REJECTED:
        usersIDs = notif.target?.connect?.id ? [notif.target?.connect?.id] : [];
        break;
      case NotificationSource.POST:
        const inses = await this.insService.inses({
          where: {
            posts: {
              some: {
                id: notif.post?.connect?.id,
              },
            },
          },
        });
        const members = await this.userConnectionService.getConnections({
          where: {
            insId: {
              in: inses.map((ins) => ins.id),
            },
            role: {
              not: UserRole.PENDING,
            },
          },
        });
        usersIDs = members.map((member) => member.userId);
        usersIDs = [...new Set(usersIDs)];
        break;
      case NotificationSource.ADDED_PHOTOS:
        this.logger.error(
          `Cannot create a notification of type ${NotificationSource.ADDED_PHOTOS}`,
        );
        throw new BadRequestException(
          `Cannot create a notification of type ${NotificationSource.ADDED_PHOTOS}`,
        );
      case NotificationSource.JOINED_INS:
        const membersIns = await this.userConnectionService.getConnections({
          where: {
            insId: {
              in: notif.ins?.connect?.id,
            },
            role: {
              not: UserRole.PENDING,
            },
          },
        });
        usersIDs = membersIns.map((member) => member.userId);
        break;
      default:
        unreachable(notif.source);
        break;
    }

    return usersIDs;
  }

  async pushData(
    token: string,
    sandbox: boolean,
    data: PushNotifications.Data,
  ) {
    if (token.toLowerCase() !== token) {
      // Android token
      const x = data.custom;

      let couldUnwrapAndSend = false;
      if (x !== undefined) {
        if (typeof x !== 'string') {
          const copy: { [key: string]: string } = {};
          Object.keys(x).forEach((each) => {
            copy[each] = JSON.stringify(x[each]);
          });

          await this.messagingService.sendToDevice(token, {
            notification: {
              title: data.title,
              body: data.body,
            },
            data: copy,
          });
          couldUnwrapAndSend = true;
        }
      }

      if (!couldUnwrapAndSend) {
        // No data, send it without

        await this.messagingService.sendToDevice(token, {
          notification: {
            title: data.title,
            body: data.body,
            target: token,
            author: '',
          },
        });
      }
    } else {
      this.logger.log(`Send push notification with sandbox ${sandbox}`);
      if (sandbox) {
        return sandboxPush.send(token, data);
      } else {
        return prodPush.send(token, data);
      }
    }
  }

  async constructNotificationBody(
    target: User,
    source: Prisma.NotificationCreateInput,
  ): Promise<PushNotifications.Data> {
    let body = '';

    const unreachable = (x: never) => {
      this.logger.error(`This shouldn't be possible! ${x}`);
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (source.source) {
      case NotificationSource.LIKE_POST:
        const authorLikePost = await this.userService.shallowUser({
          id: source.author.connect?.id,
        });
        body = `${authorLikePost?.firstName} ${authorLikePost?.lastName} liked your post!`;
        break;
      case NotificationSource.LIKE_COMMENT:
        const authorLikeComment = await this.userService.shallowUser({
          id: source.author.connect?.id,
        });
        body = `${authorLikeComment?.firstName} ${authorLikeComment?.lastName} liked your comment!`;
        break;
      case NotificationSource.COMMENT:
        const authorComment = await this.userService.shallowUser({
          id: source.author.connect?.id,
        });
        body = `${authorComment?.firstName} ${authorComment?.lastName} left a comment!`;
        break;
      case NotificationSource.POST:
        const authorPost = await this.userService.shallowUser({
          id: source.author.connect?.id,
        });
        if (source.post?.connect?.id) {
          const inses = await this.insService.inses({
            where: {
              members: {
                some: {
                  userId: target.id,
                  role: {
                    not: UserRole.PENDING,
                  },
                },
              },
              posts: {
                some: {
                  id: source.post.connect.id,
                },
              },
            },
          });
          body = `${authorPost?.firstName} ${
            authorPost?.lastName
          } added a new post in ${inses.map((ins) => ins.name)} ${
            inses.length > 1 ? 'inses' : 'ins'
          }!`;
        }
        break;
      case NotificationSource.ADDED_PHOTOS:
        this.logger.error(
          `Cannot create a notification of type ${NotificationSource.ADDED_PHOTOS}`,
        );
        throw new BadRequestException(
          `Cannot create a notification of type ${NotificationSource.ADDED_PHOTOS}`,
        );
      case NotificationSource.JOINED_INS:
        const authorInsJoined = await this.userService.shallowUser({
          id: source.author.connect?.id,
        });
        const insJoined = await this.insService.ins({
          id: source.ins?.connect?.id,
        });
        if (source.author.connect?.id === target.id) {
          body = `You joined ${insJoined?.name} ins!`;
        } else {
          body = `${authorInsJoined?.firstName} ${authorInsJoined?.lastName} joined ${insJoined?.name} ins!`;
        }
        break;
      case NotificationSource.JOIN_INS_REJECTED:
        const insJoinRejected = await this.insService.ins({
          id: source.ins?.connect?.id,
        });
        body = `Access to ${insJoinRejected?.name} has been declined!`;
        break;
      default:
        unreachable(source.source);
        break;
    }

    this.logger.log(`Body: ${body}`);

    return {
      title: 'MyINS',
      body: body,
      badge: 1,
      topic: target.sandboxToken
        ? 'com.squid40.dev.myins'
        : 'com.squid40.dev.myins',
      custom: {
        ...clean(source),
      },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean(obj: any) {
  for (const propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined) {
      delete obj[propName];
    }
  }
  return obj;
}
