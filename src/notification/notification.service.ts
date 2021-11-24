import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  Notification,
  NotificationSource,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { NotificationPushService } from './notification.push.service';
import {
  NotificationFeed,
  notificationFeedCount,
  notificationFeedQuery,
  notificationFeedWithourPost,
} from 'src/prisma-queries-helper/notification-feed';
import { omit } from 'src/util/omit';
import { UserConnectionService } from 'src/user/user.connection.service';
import { pendingUsersWhereQuery } from 'src/prisma-queries-helper/pending-users';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
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
    const feedNotificationsCount = await this.prisma.notification.count(
      notificationFeedCount(userID),
    );
    const feedNotifications = await this.prisma.notification.findMany(
      notificationFeedQuery(userID, skip, take),
    );

    this.logger.log('Adding isSeen prop for every notification');
    const user = await this.userService.user({ id: userID });
    const notification = user?.lastReadNotificationID
      ? await this.getById({ id: user.lastReadNotificationID })
      : null;
    const dataReturn = feedNotifications.map((notif) => {
      const notificationsWithINs: NotificationSource[] = [
        NotificationSource.JOINED_INS,
        NotificationSource.JOIN_INS_REJECTED,
        NotificationSource.CHANGE_ADMIN,
      ];
      if (notificationsWithINs.includes(notif.source)) {
        const ins = (<NotificationFeed>notif).ins;
        notif = omit(<NotificationFeed>notif, 'ins');
        return {
          ...notif,
          post: {
            ...(<notificationFeedWithourPost>notif).post,
            inses: [ins],
          },
          isSeen: !!notification && notification.createdAt >= notif.createdAt,
        };
      }

      return {
        ...notif,
        isSeen: !!notification && notification.createdAt >= notif.createdAt,
      };
    });

    if (skip === 0 && dataReturn.length) {
      await this.userService.setLastReadNotificationID(
        userID,
        dataReturn[0].id,
      );
    }

    this.logger.log('Successfully getting notifications feed');
    return {
      count: feedNotificationsCount,
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
  ): Promise<Notification> {
    try {
      await this.pushService.pushNotification(data);
    } catch (e) {
      const stringErr: string = <string>e;
      this.logger.error(`Error pushing device notifications! + ${stringErr}`);
    }
    return this.prisma.notification.create({
      data,
    });
  }

  async countUnreadNotifications(user: User): Promise<number | undefined> {
    const { id, lastReadNotificationID, lastReadRequest } = user;

    this.logger.log(`Counting unread notificaions for user ${user.id}`);
    const dataQuery: Prisma.NotificationCountArgs = notificationFeedCount(id);
    if (lastReadNotificationID) {
      this.logger.log(
        `Counting notifications newer than notification ${lastReadNotificationID}`,
      );
      const notification = await this.getById({ id: lastReadNotificationID });
      dataQuery.where = {
        ...dataQuery.where,
        createdAt: {
          gt: notification?.createdAt,
        },
      };
    }
    const unreadNotif = await this.prisma.notification.count(dataQuery);

    this.logger.log(`Counting unread requests for user ${user.id}`);
    const userConnections = await this.userConnectionService.getConnections({
      where: {
        userId: id,
        role: {
          not: UserRole.PENDING,
        },
      },
    });

    const dataPendingQuery: Prisma.UserInsConnectionCountArgs = {
      where: pendingUsersWhereQuery(id, userConnections),
    };
    if (lastReadRequest) {
      this.logger.log(`Counting requests newer than ${lastReadRequest}`);
      dataPendingQuery.where = {
        ...dataPendingQuery.where,
        createdAt: {
          gt: lastReadRequest,
        },
      };
    }
    const unreadRequests = await this.userConnectionService.count(
      dataPendingQuery,
    );

    return unreadNotif + unreadRequests;
  }
}
