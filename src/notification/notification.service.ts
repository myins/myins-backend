import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Notification, User, NotificationSource } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { ShallowUserSelect } from 'src/util/shallow-user';
import { NotificationPushService } from './notification.push.service';
import * as PushNotifications from 'node-pushnotifications';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
    private readonly pushService: NotificationPushService,
  ) { }

  async getFeed(userID: string, skip: number, take: number) {
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
            mediaContent: true
          },
        },
      },
      skip: skip,
      take: take,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return {
      count: count,
      data: data,
    };
  }

  async deleteNotifications(where: Prisma.NotificationWhereInput) {
    return this.prisma.notification.deleteMany({
      where: where,
    });
  }

  async createNotification(
    data: Prisma.NotificationCreateInput,
    silent?: boolean
  ): Promise<Notification> {
    const sSilent = silent ?? false
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
      return await this.pushService.pushData(
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
      const toRet = await this.pushService.pushData(
        targetUser.pushToken,
        targetUser?.sandboxToken ?? false,
        this.constructNotificationBody(authorUser, targetUser, notif),
      );
      return toRet
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

    await Promise.all(
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
      throw new Error("This shouldn't be possible!");
    }

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
        body = `${authorName} has asked to follow you!`
        break
      case 'SHARED_POST':
        body = `${authorName} has shared a post with you!`
        break
      default:
        unreachable(source.source)
        break;
    }

    const toRet = {
      title: 'MyINS',
      body: body,
      badge: 1,
      topic: target.sandboxToken
        ? 'com.adonis.myins'
        : 'com.adonis.myins',
      custom: {
        ...clean(source),
      },
    };
    return toRet;
  }
}

interface NotificationEitherInterface {
  source: NotificationSource | 'REQUESTED_FOLLOW' | 'REQUESTED_COMMENT' | 'REQUESTED_COMMENT_EDIT';
  postId?: string | null | undefined;
  commentId?: string | null | undefined;
  authorId?: string;
}

function clean(obj: any) {
  for (var propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined) {
      delete obj[propName];
    }
  }
  return obj;
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  if (value === null || value === undefined) return false;
  const testDummy: TValue = value;
  return true;
}
