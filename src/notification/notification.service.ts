import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  Notification,
  NotificationSource,
  User,
  UserRole,
  PostInsConnection,
  Post,
  INS,
  Story,
  StoryInsConnection,
  UserInsConnection,
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
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly pushService: NotificationPushService,
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
    const dataReturn = await Promise.all(
      feedNotifications.map(async (notif) => {
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
            isSeen: user && user?.lastReadNotification >= notif.createdAt,
          };
        }

        const notificationsWithPostInses: NotificationSource[] = [
          NotificationSource.POST,
          NotificationSource.LIKE_POST,
          NotificationSource.COMMENT,
          NotificationSource.LIKE_COMMENT,
          NotificationSource.DELETED_POST_BY_ADMIN,
        ];
        if (notificationsWithPostInses.includes(notif.source)) {
          const metadata = notif.metadata as Prisma.JsonObject;
          if (metadata?.insesIDs) {
            const inses = await this.insService.inses({
              where: {
                id: {
                  in: <string[]>metadata.insesIDs,
                },
              },
              select: ShallowINSSelect,
            });

            return {
              ...notif,
              post: {
                ...(<NotificationFeed>notif).post,
                inses,
              },
              isSeen: user && user?.lastReadNotification >= notif.createdAt,
            };
          }

          const castedNotif = <
            Notification & {
              post: Post & {
                inses: (PostInsConnection & {
                  ins: INS & {
                    members: UserInsConnection[];
                  };
                })[];
              };
            }
          >notif;

          return {
            ...notif,
            post: {
              ...(<NotificationFeedWithoutPost>notif).post,
              inses: castedNotif.post.inses.map((insConnection) => {
                return omit(insConnection.ins, 'members');
              }),
            },
            isSeen: user && user?.lastReadNotification >= notif.createdAt,
          };
        }

        if (notif.source === NotificationSource.STORY) {
          const castedNotif = <
            Notification & {
              story: Story & {
                inses: (StoryInsConnection & {
                  ins: INS;
                })[];
              };
            }
          >notif;

          return {
            ...notif,
            story: {
              ...(<NotificationFeedWithoutPost>notif).story,
              inses: castedNotif.story.inses.map((insConnection) => {
                return insConnection.ins;
              }),
            },
            ins: castedNotif.story.inses.sort(
              (ins1, ins2) =>
                ins1.createdAt.getTime() - ins2.createdAt.getTime(),
            )[0].ins,
            isSeen: user && user?.lastReadNotification >= notif.createdAt,
          };
        }

        return {
          ...notif,
          isSeen: user && user?.lastReadNotification >= notif.createdAt,
        };
      }),
    );

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
    const { id, lastReadNotification, lastReadRequest } = user;

    this.logger.log(`Counting unread notificaions for user ${user.id}`);
    const dataQuery: Prisma.NotificationCountArgs = notificationFeedCount(id);
    dataQuery.where = {
      ...dataQuery.where,
      createdAt: {
        gt: lastReadNotification,
      },
    };
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
    if (insIDs.length) {
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

    return unreadNotif + 0;
  }

  async removeTargetFromNotifications(targetID: string) {
    const sources = [
      NotificationSource.JOINED_INS,
      NotificationSource.POST,
      NotificationSource.STORY,
      NotificationSource.DELETED_INS,
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
                  postId: notif.postId,
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
        if (notif.source === NotificationSource.STORY && notif.storyId) {
          const inses = await this.insService.inses({
            where: {
              stories: {
                some: {
                  storyId: notif.storyId,
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
