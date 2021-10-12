import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Notification, User, NotificationSource } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { NotificationPushService } from './notification.push.service';
import * as PushNotifications from 'node-pushnotifications';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
    private readonly pushService: NotificationPushService,
  ) {}

  async getById(
    where: Prisma.NotificationWhereUniqueInput,
  ): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where,
    });
  }

  async getFeed(userID: string, skip: number, take: number) {
    this.logger.log(`Getting count and notifications for user ${userID}`);
    const count = await this.prisma.notification.count({
      where: { targetId: userID },
    });
    const data = await this.prisma.notification.findMany({
      where: {
        targetId: userID,
      },
      include: {
        author: {
          select: ShallowUserSelect,
        },
        comment: {
          select: {
            content: true,
          },
        },
        post: {
          select: {
            content: true,
            mediaContent: true,
          },
        },
      },
      skip: skip,
      take: take,
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log('Adding isSeen prop for every notification');
    const user = await this.users.user({ id: userID });
    const notification = user?.lastReadNotificationID
      ? await this.getById({ id: user?.lastReadNotificationID })
      : null;
    const dataReturn = data.map((notif) => {
      return {
        ...notif,
        isSeen: !!notification && notification.createdAt > notif.createdAt,
      };
    });

    this.logger.log('Successfully getting feed notifications');
    return {
      count: count,
      data: dataReturn,
    };
  }

  async deleteNotifications(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.deleteMany({
      where: where,
    });
  }

  async createNotification(
    data: Prisma.NotificationCreateInput,
    silent?: boolean,
  ): Promise<Notification> {
    const sSilent = silent ?? false;
    if (!sSilent) {
      this.pushSingleNotification(data);
    }
    return this.prisma.notification.create({
      data,
    });
  }

  async createManyNotifications(data: Prisma.NotificationCreateManyInput[]) {
    this.pushBatchedNotifications(data);
    return this.prisma.notification.createMany({
      data,
    });
  }

  async pushCustomNotification(
    targetID: string,
    sourceID: string,
    source: 'REQUESTED_FOLLOW' | 'REQUESTED_COMMENT' | 'REQUESTED_COMMENT_EDIT',
  ) {
    if (!targetID || !sourceID) {
      throw new BadRequestException(
        "You're supposed to always connect users for notifications!",
      );
    }

    const targetUser = await this.users.user({ id: targetID });
    const authorUser = await this.users.user({ id: sourceID });
    if (authorUser && targetUser?.pushToken) {
      return this.pushService.pushData(
        targetUser.pushToken,
        targetUser?.sandboxToken ?? false,
        this.constructNotificationBody(authorUser, targetUser, {
          source: source,
          authorId: authorUser.id,
        }),
      );
    }
  }

  async pushSingleNotification(notif: Prisma.NotificationCreateInput) {
    const targetID = notif.target.connect?.id;
    const sourceID = notif.author.connect?.id;

    if (!targetID || !sourceID) {
      throw new BadRequestException(
        "You're supposed to always connect users for notifications!",
      );
    }

    const targetUser = await this.users.user({ id: targetID });
    const authorUser = await this.users.user({ id: sourceID });
    if (authorUser && targetUser?.pushToken) {
      return this.pushService.pushData(
        targetUser.pushToken,
        targetUser?.sandboxToken ?? false,
        this.constructNotificationBody(authorUser, targetUser, notif),
      );
    }
  }

  async pushBatchedNotifications(notif: Prisma.NotificationCreateManyInput[]) {
    const userIDs = [
      ...new Set(notif.flatMap((each) => [each.targetId, each.authorId])),
    ];

    const flatMapped = userIDs.flatMap(async (each) => {
      const user = await this.users.user({ id: each });
      if (!user) {
        return;
      }
      return {
        id: user?.id,
        data: user,
      };
    });
    const users = (
      await Promise.all(flatMapped.flatMap((each) => each))
    ).filter(notEmpty);

    return Promise.all(
      notif.map(async (each) => {
        const authorUser = users.find(
          (each2) => each2.id == each.authorId,
        )?.data;
        const targetUser = users.find(
          (each2) => each2.id == each.targetId,
        )?.data;
        if (authorUser && targetUser && targetUser.pushToken) {
          this.pushService.pushData(
            targetUser.pushToken,
            targetUser.sandboxToken ?? false,
            this.constructNotificationBody(authorUser, targetUser, each),
          );
        }
      }),
    );
  }

  constructNotificationBody(
    author: User,
    target: User,
    source: NotificationEitherInterface,
  ): PushNotifications.Data {
    const authorName = `${author.firstName}`;
    let body = '';

    const unreachable = (x: never) => {
      throw new Error(`This shouldn't be possible! ${x}`);
    };

    switch (source.source) {
      case 'LIKE_POST':
        body = `${authorName} liked your post!`;
        break;
      case 'COMMENT':
        body = `${authorName} commented on your post!`;
        break;
      case 'REQUESTED_COMMENT':
        body = `${authorName} wants to comment on your post!`;
        break;
      case 'REQUESTED_COMMENT_EDIT':
        body = `${authorName} wants to edit his comment on your post!`;
        break;
      case 'LIKE_COMMENT':
        body = `${authorName} liked your comment!`;
        break;
      case 'REQUESTED_FOLLOW':
        body = `${authorName} has asked to follow you!`;
        break;
      case 'SHARED_POST':
        body = `${authorName} has shared a post with you!`;
        break;
      default:
        unreachable(source.source);
        break;
    }

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

  async countUnreadNotifications(
    lastReadNotificationID: string | null,
  ): Promise<number> {
    let data = {};
    if (lastReadNotificationID) {
      this.logger.log(
        `Getting notifications newer than notification ${lastReadNotificationID}`,
      );
      const notification = await this.getById({ id: lastReadNotificationID });
      data = {
        where: {
          createdAt: {
            gt: notification?.createdAt,
          },
        },
      };
    }
    return this.prisma.notification.count(data);
  }
}

interface NotificationEitherInterface {
  source:
    | NotificationSource
    | 'REQUESTED_FOLLOW'
    | 'REQUESTED_COMMENT'
    | 'REQUESTED_COMMENT_EDIT';
  postId?: string | null | undefined;
  commentId?: string | null | undefined;
  authorId?: string;
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

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  if (value === null || value === undefined) return false;
  return true;
}
