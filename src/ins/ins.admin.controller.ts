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
  Patch,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { PostService } from 'src/post/post.service';
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
    private readonly postService: PostService,
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
      `Deleting post ${postID} from ins ${insID} by user ${userID}`,
    );

    const isAdmin = await this.insAdminService.isAdmin(userID, insID);
    if (!isAdmin) {
      this.logger.error(`You're not allowed to delete post from ins ${insID}!`);
      throw new BadRequestException(
        "You're not allowed to delete post from this INS!",
      );
    }

    const post = await this.postService.post({ id: postID });
    if (!post?.isReported) {
      this.logger.error(`Post ${postID} is not reported!`);
      throw new BadRequestException('Post is not reported!');
    }

    const updatedPost: Prisma.PostUpdateArgs = {
      where: {
        id: postID,
      },
      data: {},
    };
    if (data.isDeleted) {
      updatedPost.data = {
        inses: {
          disconnect: {
            id: insID,
          },
        },
      };
    } else {
      updatedPost.data = {
        isReported: false,
      };
    }

    return this.postService.updatePost(updatedPost);
  }
}
