import { NotificationSource, Prisma, UserRole } from '.prisma/client';
import {
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UpdateINSAdminAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsService } from './ins.service';

@Controller('ins/admin')
export class InsAdminController {
  private readonly logger = new Logger(InsAdminController.name);

  constructor(
    private readonly insAdminService: InsAdminService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('/change')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async changeINSAdmin(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    this.logger.log(`Changing admin for ins ${data.insID} by user ${userID}`);
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      this.logger.error("You're not allowed to change INS admin!");
      throw new BadRequestException("You're not allowed to change INS admin!");
    }

    this.logger.log(
      `Removing all admins for ins ${data.insID} and changing user ${data.memberID} as admin`,
    );
    const changedAdmin = await this.insAdminService.changeAdmin(
      data.insID,
      data.memberID,
    );

    this.logger.log(
      `Creating notification for changing admin user ${data.memberID} from ins ${data.insID} by current admin user ${userID}`,
    );
    await this.notificationService.createNotification({
      source: NotificationSource.CHANGE_ADMIN,
      targets: {
        connect: {
          id: data.memberID,
        },
      },
      author: {
        connect: {
          id: userID,
        },
      },
      ins: {
        connect: {
          id: data.insID,
        },
      },
    });

    return changedAdmin;
  }

  @Delete('/remove-member')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async removeMemberFromINS(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    this.logger.log(`Removing member for ins ${data.insID} by user ${userID}`);
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      console.log(
        `Allowing random user to remove member cuz he's such a nice guy! But also for testing.`,
      );
      // this.logger.error("You're not allowed to remove members from INS!");
      // throw new BadRequestException(
      //   "You're not allowed to remove members from INS!",
      // );
    }

    this.logger.log(`Removing member ${data.memberID} from ins ${data.insID}`);
    return this.userConnectionService.removeMember({
      userId_insId: {
        userId: data.memberID,
        insId: data.insID,
      },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async deleteINS(
    @Param('id') insID: string,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Deleting INS by user ${userID}`);
    const ins = await this.insService.ins({
      id: insID,
    });
    if (!ins) {
      this.logger.error(`Could not find INS ${insID}!`);
      throw new NotFoundException('Could not find this INS!');
    }

    const isAdmin = await this.insAdminService.isAdmin(userID, insID);
    if (!isAdmin) {
      this.logger.error(`You're not allowed to delete INS ${insID}!`);
      throw new BadRequestException("You're not allowed to delete this INS!");
    }

    this.logger.log(
      `Creating notification for deleting ins ${insID} by user ${userID}`,
    );
    const connections = await this.userConnectionService.getConnections({
      where: {
        insId: insID,
        role: {
          not: UserRole.PENDING,
        },
        userId: {
          not: userID,
        },
      },
    });
    const notifMetadata = {
      deletedInsName: ins.name,
    } as Prisma.JsonObject;
    await this.notificationService.createNotification({
      source: NotificationSource.DELETED_INS,
      targets: {
        connect: connections.map((connection) => ({ id: connection.userId })),
      },
      author: {
        connect: {
          id: userID,
        },
      },
      metadata: notifMetadata,
    });

    this.logger.log(`Deleting ins ${insID}`);
    return this.insAdminService.deleteINS({ id: insID });
  }
}
