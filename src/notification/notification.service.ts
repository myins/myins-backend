import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
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
  NotificationFeedWithoutPost,
} from 'src/prisma-queries-helper/notification-feed';
import { omit } from 'src/util/omit';
import { UserConnectionService } from 'src/user/user.connection.service';
import { InsService } from 'src/ins/ins.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly pushService: NotificationPushService,
    @Inject(forwardRef(() => InsService))
    private readonly insService: InsService,
  ) {}

  async getById(
    where: Prisma.NotificationWhereUniqueInput,
  ): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where,
    });
  }

  async getNotifications(params: Prisma.NotificationFindManyArgs) {
    return this.prisma.notification.findMany(params);
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
            ...(<NotificationFeedWithoutPost>notif).post,
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
    const insIDs = userConnections.map((connection) => connection.insId);
    const unreadRequests = await this.prisma.$queryRaw<
      { count: number }[]
    >(Prisma.sql`SELECT count(*) FROM "public"."UserInsConnection" as uic
    INNER JOIN "User" as u on u.id=uic."userId"
    WHERE 
      uic."role"=${UserRole.PENDING} AND 
      u."isDeleted"=false AND 
      (
        (
          uic."userId"=${id} AND 
          uic."invitedBy" IS NOT NULL
        ) OR 
        (
          uic."insId" IN (${Prisma.join(insIDs)}) AND 
          uic."invitedBy" IS NULL AND
          (
            uic."deniedByUsers" IS NULL OR
            NOT uic."deniedByUsers" && '{${Prisma.raw(id)}}'::text[]
          )
        )
      ) AND
      uic."createdAt" >= 
        (SELECT "createdAt" FROM "UserInsConnection" as myuic 
        WHERE myuic."userId"=${id} AND myuic."insId"=uic."insId") AND
      uic."createdAt" > ${
        lastReadRequest ?? new Date(new Date().setFullYear(2000))
      }`);

    return unreadNotif + unreadRequests[0].count;
  }

  async removeTargetFromNotifications(targetID: string) {
    const sources = [
      NotificationSource.JOINED_INS,
      NotificationSource.POST,
      NotificationSource.CHANGE_ADMIN,
    ];
    this.logger.log(
      `Getting notifications of type ${sources} for target ${targetID}`,
    );
    const notifs = await this.getNotifications({
      where: {
        source: {
          in: sources,
        },
        targets: {
          some: {
            id: targetID,
          },
        },
      },
    });

    await Promise.all(
      notifs.map(async (notif, index) => {
        if (notif.source === NotificationSource.POST && notif.postId) {
          const inses = await this.insService.inses({
            where: {
              posts: {
                some: {
                  id: notif.postId,
                },
              },
              members: {
                some: {
                  userId: targetID,
                },
              },
            },
          });
          if (inses.length) {
            notifs.splice(index, 1);
          }
        }
      }),
    );

    this.logger.log(`Removing notifications for target ${targetID}`);
    const notifIDs = notifs.map((notif) => ({ id: notif.id }));
    await this.userService.updateUser({
      where: {
        id: targetID,
      },
      data: {
        notifications: {
          disconnect: notifIDs,
        },
      },
    });
  }
}
