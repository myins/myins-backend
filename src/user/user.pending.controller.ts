import { NotificationSource, UserRole } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChatService } from 'src/chat/chat.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { NotificationService } from 'src/notification/notification.service';
import {
  PendingUsersInclude,
  pendingUsersIncludeQueryType,
  pendingUsersWhereQuery,
} from 'src/prisma-queries-helper/pending-users';
import { UserService } from 'src/user/user.service';
import { ApproveDenyUserAPI } from './user-api.entity';
import { UserConnectionService } from './user.connection.service';

@Controller('user/pending')
@UseInterceptors(NotFoundInterceptor)
export class UserPendingController {
  private readonly logger = new Logger(UserPendingController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async getPendingUsers(
    @PrismaUser('id') id: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    all?: boolean,
  ) {
    this.logger.log(
      `Getting pending users for inses where user ${id} is a member`,
    );
    const userConnections = await this.userConnectionService.getConnections({
      where: {
        userId: id,
        role: {
          not: UserRole.PENDING,
        },
      },
    });
    const countPendingUsers = await this.userConnectionService.count({
      where: pendingUsersWhereQuery(id, userConnections),
    });
    const pendingConenctions = await this.userConnectionService.getConnections({
      where: pendingUsersWhereQuery(id, userConnections),
      include: pendingUsersIncludeQueryType,
      skip: skip,
      take: all ? countPendingUsers : take,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const dataPendingUsers = await Promise.all(
      pendingConenctions.map(async (connection) => {
        const conn = <PendingUsersInclude>connection;
        return {
          authorId: conn.invitedBy ?? conn.user.id,
          author: conn.invitedBy
            ? await this.userService.shallowUser({ id: conn.invitedBy })
            : conn.user,
          ins: conn.ins,
          createdAt: conn.createdAt,
          isInvitation: connection.userId === id,
        };
      }),
    );

    return {
      count: countPendingUsers,
      data: dataPendingUsers,
    };
  }

  @Patch('approve')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async approve(
    @PrismaUser('id') id: string,
    @Body() data: ApproveDenyUserAPI,
  ) {
    if (id !== data.userID) {
      const connection =
        await this.userConnectionService.getNotPendingConnection({
          userId_insId: {
            userId: id,
            insId: data.insID,
          },
        });
      if (!connection) {
        this.logger.error(
          "You're not allowed to approve members for this INS!",
        );
        throw new BadRequestException(
          "You're not allowed to approve members for this INS!",
        );
      }
    }

    const memberConnection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: data.userID,
        insId: data.insID,
      },
    });
    if (!memberConnection) {
      this.logger.error(
        `User ${data.userID} that you want to approve is not a pending member for ins ${data.insID}`,
      );
      throw new BadRequestException(
        'User that you want to approve is not a pending member for that ins!',
      );
    }
    if (memberConnection.role === UserRole.PENDING) {
      this.logger.log(
        `Approving user ${data.userID} in ins ${data.insID} by user ${id}`,
      );
      await this.userService.approveUser(data.userID, data.insID);
    }

    this.logger.log('User successfully approved');
    return {
      message: 'User successfully approved',
    };
  }

  @Patch('approve-all')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async approveAll(@PrismaUser('id') id: string) {
    this.logger.log(`Approving all pending users by user ${id}`);
    const pendingUsers = await this.getPendingUsers(id, 0, 0, true);

    await Promise.all(
      pendingUsers.data.map(async (aData) => {
        await this.approve(id, {
          insID: aData.ins.id,
          userID: aData.authorId,
        });
      }),
    );

    this.logger.log('Users successfully approved');
    return {
      message: 'Users successfully approved',
    };
  }

  @Patch('deny')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async deny(@PrismaUser('id') id: string, @Body() data: ApproveDenyUserAPI) {
    if (id !== data.userID) {
      const connection = await this.userConnectionService.getConnection({
        userId_insId: {
          userId: id,
          insId: data.insID,
        },
      });
      if (!connection || connection.role === UserRole.PENDING) {
        this.logger.error("You're not allowed to deny members for this INS!");
        throw new BadRequestException(
          "You're not allowed to deny members for this INS!",
        );
      }
    }

    const memberConnection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: data.userID,
        insId: data.insID,
      },
    });
    if (memberConnection?.role === UserRole.PENDING) {
      this.logger.log(
        `Denying user ${data.userID} from ins ${data.insID} by user ${id}`,
      );
      const updatedMemberConnection = await this.userService.denyUser(
        id,
        data.userID,
        data.insID,
      );

      if (id !== data.userID) {
        const connections = await this.userConnectionService.getConnections({
          where: {
            insId: data.insID,
            role: {
              not: UserRole.PENDING,
            },
          },
        });
        const noDenyMembers = connections.find(
          (connection) =>
            !updatedMemberConnection.deniedByUsers.includes(connection.userId),
        );

        if (!noDenyMembers) {
          this.logger.log(
            `Creating notification for decining user ${data.userID} from ins ${data.insID}`,
          );
          await this.notificationService.createNotification({
            source: NotificationSource.JOIN_INS_REJECTED,
            target: {
              connect: {
                id: data.userID,
              },
            },
            author: {
              connect: {
                id: data.userID,
              },
            },
            ins: {
              connect: {
                id: data.insID,
              },
            },
          });
        }
      }
    }

    this.logger.log('User successfully denied');
    return {
      message: 'User successfully denied',
    };
  }
}
