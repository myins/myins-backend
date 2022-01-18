import {
  NotificationSource,
  PostInsConnection,
  Prisma,
  UserRole,
  Post as PostModel,
  INS,
} from '.prisma/client';
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
  Patch,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { PostConnectionService } from 'src/post/post.connection.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
import { UserConnectionService } from 'src/user/user.connection.service';
import {
  ChangeNameAPI,
  DeletePostFromINSAPI,
  UpdateINSAdminAPI,
} from './ins-api.entity';
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
    private readonly postConnectionService: PostConnectionService,
  ) {}

  @Post('change')
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

  @Patch(':id/change-name')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async changeName(
    @PrismaUser('id') userId: string,
    @Param('id') insId: string,
    @Body() data: ChangeNameAPI,
  ) {
    const isAdmin = await this.insAdminService.isAdmin(userId, insId);
    if (!isAdmin) {
      this.logger.error("You're not allowed to change INS name!");
      throw new BadRequestException("You're not allowed to change INS name!");
    }

    this.logger.log(`Updating ins ${insId}. Change name`);
    await this.insService.update({
      where: {
        id: insId,
      },
      data: {
        name: data.name,
      },
    });

    this.logger.log('Successfully change name');
    return {
      message: 'Successfully change name',
    };
  }

  @Delete('remove-member')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async removeMemberFromINS(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    this.logger.log(`Removing member for ins ${data.insID} by user ${userID}`);
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      this.logger.error("You're not allowed to remove members from INS!");
      throw new BadRequestException(
        "You're not allowed to remove members from INS!",
      );
    }

    this.logger.log(`Removing member ${data.memberID} from ins ${data.insID}`);
    const toRet = await this.userConnectionService.removeMember({
      userId_insId: {
        userId: data.memberID,
        insId: data.insID,
      },
    });

    this.logger.log(`Removing target ${data.memberID} from notifications`);
    await this.notificationService.removeTargetFromNotifications(data.memberID);

    return toRet;
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

  @Get('reports')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async getReportedPosts(
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    if (isNaN(skip) || isNaN(take)) {
      this.logger.error('Skip and take must be number!');
      throw new BadRequestException('Skip and take must be number!');
    }

    this.logger.log(`Getting all inses where user ${userID} is admin`);
    const adminInses = await this.insService.inses({
      where: {
        members: {
          some: {
            userId: userID,
            role: UserRole.ADMIN,
          },
        },
      },
    });

    const whereQuery: Prisma.PostInsConnectionWhereInput = {
      id: {
        in: adminInses.map((ins) => ins.id),
      },
      reportedAt: {
        not: null,
      },
    };

    this.logger.log(`Counting all reported post for admin ${userID}`);
    const countReportedPosts = await this.postConnectionService.count({
      where: whereQuery,
    });

    this.logger.log(`Getting reported post for admin ${userID}`);
    const reportedPostConnections =
      await this.postConnectionService.getInsConnections({
        where: whereQuery,
        include: {
          post: {
            include: {
              mediaContent: true,
            },
          },
          ins: {
            select: ShallowINSSelect,
          },
        },
        orderBy: {
          reportedAt: 'desc',
        },
        skip,
        take,
      });

    const castedReportedPostsConnections = <
      (PostInsConnection & {
        post: PostModel;
        ins: INS;
      })[]
    >reportedPostConnections;

    const toRetData = castedReportedPostsConnections.map((reportedPost) => {
      return {
        post: reportedPost.post,
        ins: reportedPost.ins,
        createdAt: reportedPost.reportedAt,
        countUsers: reportedPost.reportedByUsers.length,
      };
    });

    return {
      count: countReportedPosts,
      data: toRetData,
    };
  }

  @Delete(':id/post/:postID')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async deletePostFromINS(
    @Param('id') insID: string,
    @Param('postID') postID: string,
    @PrismaUser('id') userID: string,
    @Body() data: DeletePostFromINSAPI,
  ) {
    this.logger.log(
      `Deciding action for reported post ${postID} from ins ${insID} by user ${userID}`,
    );

    const isAdmin = await this.insAdminService.isAdmin(userID, insID);
    if (!isAdmin) {
      this.logger.error(`You're not allowed to delete post from ins ${insID}!`);
      throw new BadRequestException(
        "You're not allowed to delete post from this INS!",
      );
    }

    const connection = await this.postConnectionService.get({
      postId_id: {
        id: insID,
        postId: postID,
      },
    });
    if (!connection?.reportedAt) {
      this.logger.error(`Post is no longer reported in ins ${insID}!`);
      throw new BadRequestException('Post is no longer reported in INS!');
    }

    if (data.isDeleted) {
      this.logger.log(
        `Deleting post ${postID} from ins ${insID} by user ${userID}`,
      );
      return this.postConnectionService.delete({
        postId_id: {
          id: insID,
          postId: postID,
        },
      });
    } else {
      this.logger.log(
        `Removing reporting for post ${postID} from ins ${insID} by user ${userID}`,
      );
      return this.postConnectionService.update({
        where: {
          postId_id: {
            id: insID,
            postId: postID,
          },
        },
        data: {
          reportedAt: null,
          reportedByUsers: [],
        },
      });
    }
  }
}
