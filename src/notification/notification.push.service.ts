import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as PushNotifications from 'node-pushnotifications';
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev
import { FirebaseMessagingService } from '@aginix/nestjs-firebase-admin';
import {
  INS,
  NotificationSource,
  Post,
  Prisma,
  Story,
  User,
  UserRole,
} from '.prisma/client';
import { UserService } from 'src/user/user.service';
import { InsService } from 'src/ins/ins.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import { NotificationService } from './notification.service';
import {
  NotificationCache,
  NotificationCacheService,
} from './notification.cache.service';
import { isProd } from 'src/util/checks';

export enum PushNotificationSource {
  REQUEST_FOR_OTHER_USER = 'REQUEST_FOR_OTHER_USER',
  REQUEST_FOR_ME = 'REQUEST_FOR_ME',
  REPORT_ADMIN = 'REPORT_ADMIN',
}

export interface PushExtraNotification {
  source: PushNotificationSource;
  author?: User | null;
  ins?: INS | null;
  post?: Post | null;
  targets: string[];
  countUsers?: number;
}

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
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly cacheService: NotificationCacheService,
  ) {}

  async pushNotification(
    notif: Prisma.NotificationCreateInput | PushExtraNotification,
  ) {
    const usersIDs = await this.getUsersIDsBySource(notif);

    const prismaCache = await this.cacheService.getDBCache(
      <Prisma.NotificationCreateInput>notif,
    );

    await Promise.all(
      usersIDs.map(async (userID) => {
        this.logger.log(
          `Preparing push notification of type ${notif.source} for user ${userID}`,
        );
        const target = await this.userService.user({ id: userID });

        const pushNotifications: PushNotificationSource[] = <
          PushNotificationSource[]
        >(<unknown>Object.keys(PushNotificationSource));
        let realSource: NotificationSource | PushNotificationSource =
          notif.source;
        if (pushNotifications.includes(<PushNotificationSource>notif.source)) {
          realSource = NotificationSource.JOINED_INS;
        }
        const isNotDisableNotification =
          !target?.disabledNotifications.includes(
            <NotificationSource>realSource,
          );

        const isMute = await this.checkIfInsIsMuteForUser(target, notif);

        if (target?.pushToken && isNotDisableNotification && !isMute) {
          this.logger.log(`Adding push notification for user ${target.id}`);
          if (notif.source === NotificationSource.STORY) {
            const inses = await this.insService.inses({
              where: {
                members: {
                  some: {
                    userId: target.id,
                  },
                },
                stories: {
                  some: {
                    storyId: notif.story?.connect?.id,
                  },
                },
              },
            });
            notif.ins = {
              connect: {
                id: inses.sort(
                  (ins1, ins2) =>
                    ins1.createdAt.getTime() - ins2.createdAt.getTime(),
                )[0].id,
              },
            };
          }
          const notifBody = await this.constructNotificationBody(
            target,
            notif,
            prismaCache,
          );
          const result = await this.pushData(
            target.pushToken,
            target?.sandboxToken ?? false,
            notifBody,
          );
          this.logger.log(
            `Push notification result = ${JSON.stringify(result)}`,
          );
        } else {
          this.logger.log(
            `Push notification has not been sent for user ${target?.id}`,
          );
        }
      }),
    );
  }

  async getUsersIDsBySource(
    notif: Prisma.NotificationCreateInput | PushExtraNotification,
  ): Promise<string[]> {
    const normalNotif = <Prisma.NotificationCreateInput>notif;
    const pushNotif = <PushExtraNotification>notif;
    let usersIDs: string[] = [];

    const unreachable = (x: never) => {
      this.logger.error(`This shouldn't be possible! ${x}`);
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (notif.source) {
      case NotificationSource.JOIN_INS_REJECTED:
      case NotificationSource.CHANGE_ADMIN:
      case NotificationSource.PENDING_INS:
      case NotificationSource.DELETED_POST_BY_ADMIN:
        const id = (<Prisma.UserWhereUniqueInput>normalNotif.targets?.connect)
          .id;
        usersIDs = id !== undefined ? [id] : [];
        break;
      case NotificationSource.DELETED_INS:
      case NotificationSource.POST:
      case NotificationSource.STORY:
      case NotificationSource.JOINED_INS:
      case NotificationSource.COMMENT:
      case NotificationSource.LIKE_POST:
      case NotificationSource.LIKE_COMMENT:
      case NotificationSource.LIKE_STORY:
        const ids = (<Array<Prisma.UserWhereUniqueInput>>(
          normalNotif.targets?.connect
        ))
          .map((connect) => connect.id)
          .filter((id) => id !== undefined);
        usersIDs = [...new Set(<Array<string>>ids)];
        break;
      case NotificationSource.MESSAGE:
        this.logger.error(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
        throw new BadRequestException(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
      case PushNotificationSource.REQUEST_FOR_OTHER_USER:
      case PushNotificationSource.REQUEST_FOR_ME:
      case PushNotificationSource.REPORT_ADMIN:
        usersIDs = pushNotif.targets;
        break;
      default:
        unreachable(notif);
        break;
    }

    return usersIDs;
  }

  async checkIfInsIsMuteForUser(
    user: User | null,
    notif: Prisma.NotificationCreateInput | PushExtraNotification,
  ): Promise<boolean> {
    const normalNotif = <Prisma.NotificationCreateInput>notif;
    const pushNotif = <PushExtraNotification>notif;
    let isMute = false;

    const unreachable = (x: never) => {
      this.logger.error(`This shouldn't be possible! ${x}`);
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (notif.source) {
      case NotificationSource.JOINED_INS:
      case NotificationSource.JOIN_INS_REJECTED:
      case NotificationSource.CHANGE_ADMIN:
      case NotificationSource.PENDING_INS:
      case NotificationSource.DELETED_POST_BY_ADMIN:
      case NotificationSource.LIKE_POST:
      case NotificationSource.LIKE_COMMENT:
      case NotificationSource.COMMENT:
      case NotificationSource.POST:
      case NotificationSource.LIKE_STORY:
        if (normalNotif.ins?.connect?.id && user?.id) {
          const connectionNormalNotif =
            await this.userConnectionService.getConnection({
              userId_insId: {
                insId: normalNotif.ins.connect.id,
                userId: user.id,
              },
            });
          isMute = !!connectionNormalNotif?.muteUntil;
        }
        break;
      case PushNotificationSource.REQUEST_FOR_ME:
      case PushNotificationSource.REQUEST_FOR_OTHER_USER:
      case PushNotificationSource.REPORT_ADMIN:
        if (pushNotif.ins?.id && user?.id) {
          const connectionPushNotif =
            await this.userConnectionService.getConnection({
              userId_insId: {
                insId: pushNotif.ins.id,
                userId: user.id,
              },
            });
          isMute = !!connectionPushNotif?.muteUntil;
        }
        break;
      case NotificationSource.MESSAGE:
        this.logger.error(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
        throw new BadRequestException(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
      case NotificationSource.DELETED_INS:
        break;
      case NotificationSource.STORY:
        if (normalNotif.story?.connect?.id && user?.id) {
          const connections = await this.userConnectionService.getConnections({
            where: {
              ins: {
                stories: {
                  some: {
                    storyId: normalNotif.story.connect.id,
                  },
                },
              },
              userId: user.id,
              muteUntil: null,
            },
          });
          if (!connections.length) {
            isMute = true;
          }
        }
        break;
      default:
        unreachable(notif);
        break;
    }

    return isMute;
  }

  // This function should not be allowed to be async!! Discuss
  async constructNotificationBody(
    target: User,
    source: Prisma.NotificationCreateInput | PushExtraNotification,
    prismaCache: NotificationCache,
  ): Promise<PushNotifications.Data> {
    const normalNotif = <Prisma.NotificationCreateInput>source;
    const pushNotif = <PushExtraNotification>source;
    let body = '';

    const unreachable = (x: never) => {
      this.logger.error(`This shouldn't be possible! ${x}`);
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (source.source) {
      case NotificationSource.LIKE_POST:
        const authorLikePost = prismaCache.author;
        const postLikePost = prismaCache.post;
        const castedPostLikePost = <
          Post & {
            author: User;
          }
        >postLikePost;
        body = `${authorLikePost?.firstName} ${
          authorLikePost?.lastName
        } liked ${
          castedPostLikePost.author.id === target.id
            ? 'your'
            : `${castedPostLikePost.author.firstName} ${castedPostLikePost.author.lastName}'s`
        } post!`;
        break;
      case NotificationSource.LIKE_COMMENT:
        const authorLikeComment = prismaCache.author;
        const commentLikeComment = prismaCache.comment;
        const castedCommentLikeComment = <
          Comment & {
            author: User;
          }
        >(<unknown>commentLikeComment);
        body = `${authorLikeComment?.firstName} ${
          authorLikeComment?.lastName
        } liked ${
          castedCommentLikeComment.author.id === target.id
            ? 'your'
            : `${castedCommentLikeComment.author.firstName} ${castedCommentLikeComment.author.lastName}'s`
        } comment!`;
        break;
      case NotificationSource.LIKE_STORY:
        const authorLikeStory = prismaCache.author;
        const storyLikeStory = prismaCache.story;
        const castedStoryLikeStory = <
          Story & {
            author: User;
          }
        >storyLikeStory;
        body = `${authorLikeStory?.firstName} ${
          authorLikeStory?.lastName
        } reacted to ${
          castedStoryLikeStory.author.id === target.id
            ? 'your'
            : `${castedStoryLikeStory.author.firstName} ${castedStoryLikeStory.author.lastName}'s`
        } story!`;
        break;
      case NotificationSource.COMMENT:
        const authorComment = prismaCache.author;
        const postComment = prismaCache.post;
        const castedPostComment = <
          Post & {
            author: User;
          }
        >postComment;
        body = `${authorComment?.firstName} ${
          authorComment?.lastName
        } left a comment to ${
          castedPostComment.author.id === target.id
            ? 'your'
            : `${castedPostComment.author.firstName} ${castedPostComment.author.lastName}'s`
        } post!`;
        break;
      case NotificationSource.POST:
        const authorPost = prismaCache.author;
        let inses: INS[] = [];
        const metadataPost = normalNotif.metadata as Prisma.JsonObject;
        if (metadataPost?.insesIDs) {
          if (prismaCache.inses) {
            inses = prismaCache.inses;
          }
        } else if (normalNotif.post?.connect?.id) {
          inses = await this.insService.inses({
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
                  id: normalNotif.post.connect.id,
                },
              },
            },
          });
        }
        body = `${authorPost?.firstName} ${
          authorPost?.lastName
        } added a new post in ${inses.map((ins) => ins.name)} ${
          inses.length > 1 ? 'inses' : 'ins'
        }!`;
        break;
      case NotificationSource.JOINED_INS:
        const authorInsJoined = prismaCache.author;
        const insJoined = prismaCache.ins;
        if (normalNotif.author.connect?.id === target.id) {
          body = `You joined ${insJoined?.name} ins!`;
        } else {
          body = `${authorInsJoined?.firstName} ${authorInsJoined?.lastName} joined ${insJoined?.name} ins!`;
        }
        break;
      case NotificationSource.JOIN_INS_REJECTED:
        const insJoinRejected = prismaCache.ins;
        body = `Your request to access ${insJoinRejected?.name} ins has been declined!`;
        break;
      case NotificationSource.CHANGE_ADMIN:
        const authorChangeAdmin = prismaCache.author;
        const insChangeAdmin = prismaCache.ins;
        body = `You have been assigned as Admin in ${insChangeAdmin?.name} ins by ${authorChangeAdmin?.firstName} ${authorChangeAdmin?.lastName}!`;
        break;
      case NotificationSource.DELETED_INS:
        const authorDeletedIns = prismaCache.author;
        const metadata = normalNotif.metadata as Prisma.JsonObject;
        body = `${authorDeletedIns?.firstName} ${authorDeletedIns?.lastName} deleted ${metadata?.deletedInsName} ins!`;
        break;
      case NotificationSource.PENDING_INS:
        const insPendingIns = prismaCache.ins;
        body = `You are now a pending user for ${insPendingIns?.name} ins!`;
        break;
      case NotificationSource.DELETED_POST_BY_ADMIN:
        const authorDeletedPostByAdmin = prismaCache.author;
        const insDeletedPostByAdmin = prismaCache.ins;
        body = `Your post was deleted by ${authorDeletedPostByAdmin?.firstName} ${authorDeletedPostByAdmin?.lastName} from ins ${insDeletedPostByAdmin?.name} due to inappropriate content!`;
        break;
      case NotificationSource.STORY:
        const authorStory = prismaCache.author;
        if (normalNotif.story?.connect?.id) {
          const inses = await this.insService.inses({
            where: {
              members: {
                some: {
                  userId: target.id,
                  role: {
                    not: UserRole.PENDING,
                  },
                  muteUntil: null,
                },
              },
              stories: {
                some: {
                  storyId: normalNotif.story.connect.id,
                },
              },
            },
          });
          body = `${authorStory?.firstName} ${
            authorStory?.lastName
          } added a new story in ${inses.map((ins) => ins.name)} ${
            inses.length > 1 ? 'inses' : 'ins'
          }!`;
        }
        break;
      case NotificationSource.MESSAGE:
        this.logger.error(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
        throw new BadRequestException(
          `Cannot create a notification of type ${NotificationSource.MESSAGE}`,
        );
      case PushNotificationSource.REQUEST_FOR_OTHER_USER:
        body = `${pushNotif.author?.firstName} ${pushNotif.author?.lastName} requested access to ${pushNotif.ins?.name} ins!`;
        break;
      case PushNotificationSource.REQUEST_FOR_ME:
        body = `${pushNotif.author?.firstName} ${pushNotif.author?.lastName} invited you to join ${pushNotif.ins?.name} ins!`;
        break;
      case PushNotificationSource.REPORT_ADMIN:
        body = `This post has been reported by ${pushNotif.countUsers} ${
          pushNotif.countUsers && pushNotif.countUsers > 1 ? 'users' : 'user'
        } as being inappropriate in ${pushNotif.ins?.name} ins!`;
        break;
      default:
        unreachable(source);
        break;
    }

    this.logger.log(`Body: ${body}`);
    const unreadNotif = await this.notificationService.countUnreadNotifications(
      target,
    );

    const theToken = isProd() ? 'uk.co.myins.myins' : 'com.squid40.dev.myins';

    return {
      title: 'MyINS',
      body: body,
      badge: unreadNotif ? unreadNotif + 1 : 1,
      contentAvailable: true,
      mutableContent: 1,
      topic: theToken,
      custom: {
        ...clean(source),
      },
    };
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean(obj: any) {
  for (const propName in obj) {
    if (!obj[propName]) {
      delete obj[propName];
    }
  }
  return obj;
}
