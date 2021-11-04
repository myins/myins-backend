import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Notification, NotificationSource } from '@prisma/client';
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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
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
      ? await this.getById({ id: user?.lastReadNotificationID })
      : null;
    const dataReturn = feedNotifications.map((notif) => {
      const notificationsWithINs: NotificationSource[] = [
        NotificationSource.JOINED_INS,
        NotificationSource.JOIN_INS_REJECTED,
      ];
      if (notificationsWithINs.includes(notif.source)) {
        const ins = (<NotificationFeed>notif).ins;
        if (ins) {
          (<notificationFeedWithourPost>notif).post = {
            inses: [ins],
          };
        }
      }
      notif = omit(<NotificationFeed>notif, 'ins');
      return {
        ...notif,
        isSeen: !!notification && notification.createdAt > notif.createdAt,
      };
    });

    await this.userService.setLastReadNotificationID(userID, dataReturn[0].id);

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
      this.logger.error('Error pushing device notifications!', stringErr);
    }
    return this.prisma.notification.create({
      data,
    });
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
