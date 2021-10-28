import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Notification } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { NotificationPushService } from './notification.push.service';
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

    this.logger.log('Successfully getting notifications feed');
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
    // const sSilent = silent ?? false;
    // if (!sSilent) {
    //   this.pushService.pushNotification(data);
    // }
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
