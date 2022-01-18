import { Prisma, UserRole } from '.prisma/client';
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
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { PendingUser } from 'src/prisma-queries-helper/pending-user-interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { ApproveDenyUserAPI } from './user-api.entity';
import { UserConnectionService } from './user.connection.service';

@Controller('user/pending')
@UseInterceptors(NotFoundInterceptor)
export class UserPendingController {
  private readonly logger = new Logger(UserPendingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
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
    if (isNaN(skip) || isNaN(take)) {
      this.logger.error('Skip and take must be number!');
      throw new BadRequestException('Skip and take must be number!');
    }
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
    const insIDs = userConnections.map((connection) => connection.insId);
    const countPendingUsers = await this.prisma.$queryRaw<
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
        WHERE myuic."userId"=${id} AND myuic."insId"=uic."insId");`);

    const pendingConenctions = await this.prisma.$queryRaw<
      PendingUser[]
    >(Prisma.sql`SELECT 
      uic."invitedBy",
      uic."createdAt",
      u.id as "userId",
      u."firstName" as "userFirstName",
      u."lastName" as "userLastName",
      u."profilePicture" as "userProfilePicture",
      u."isDeleted" as "userIsDeleted",
      i."id" as "insId",
      i."name" as "insName",
      i."cover" as "insCover",
      i."shareCode" as "insShareCode",
      i."createdAt" as "insCreatedAt"
    FROM "public"."UserInsConnection" as uic
    INNER JOIN "User" as u on u.id=uic."userId"
    INNER JOIN "INS" as i on i.id=uic."insId"
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
        WHERE myuic."userId"=${id} AND myuic."insId"=uic."insId")
    ORDER BY uic."createdAt" DESC
    OFFSET     ${skip} ROWS
    FETCH NEXT ${all ? countPendingUsers[0].count : take} ROWS ONLY;`);

    const dataPendingUsers = await Promise.all(
      pendingConenctions.map(async (connection) => {
        const user = {
          firstName: connection.userFirstName,
          lastName: connection.userLastName,
          profilePicture: connection.userProfilePicture,
          id: connection.userId,
          isDeleted: connection.userIsDeleted,
        };
        const ins = {
          id: connection.insId,
          name: connection.insName,
          cover: connection.insCover,
          shareCode: connection.insShareCode,
          createdAt: connection.insCreatedAt,
        };
        return {
          authorId: connection.invitedBy ?? connection.userId,
          author: connection.invitedBy
            ? await this.userService.shallowUser({ id: connection.invitedBy })
            : user,
          ins: ins,
          createdAt: connection.createdAt,
          isInvitation: connection.userId === id,
        };
      }),
    );

    if (skip === 0) {
      this.logger.log(
        `Updating user ${id}. Set last read request to current date`,
      );
      await this.userService.updateUser({
        where: {
          id: id,
        },
        data: {
          lastReadRequest: new Date(),
        },
      });
    }

    return {
      count: countPendingUsers[0].count,
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
      await this.userService.denyUser(id, data.userID, data.insID);
    }

    this.logger.log('User successfully denied');
    return {
      message: 'User successfully denied',
    };
  }
}
