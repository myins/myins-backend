import {
  NotificationSource,
  Prisma,
  UserRole,
  Post as PostModel,
  INS,
  PostContent,
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
import { MediaService } from 'src/media/media.service';
import { NotificationService } from 'src/notification/notification.service';
import { PostService } from 'src/post/post.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
import { UserConnectionService } from 'src/user/user.connection.service';
import { omit } from 'src/util/omit';
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
    private readonly mediaService: MediaService,
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
        userId: {
          not: userID,
        },
        role: {
          not: UserRole.PENDING,
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

    const whereQuery: Prisma.PostWhereInput = {
      insId: {
        in: adminInses.map((ins) => ins.id),
      },
      reportedAt: {
        not: null,
      },
    };

    this.logger.log(`Counting all reported post for admin ${userID}`);
    const countReportedPosts = await this.postService.count({
      where: whereQuery,
    });

    this.logger.log(`Getting reported post for admin ${userID}`);
    const reportedPosts = await this.postService.posts({
      where: whereQuery,
      include: {
        mediaContent: {
          include: {
            stickers: true,
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

    const castedReportedPosts = <
      (PostModel & {
        ins: INS;
      })[]
    >reportedPosts;

    const toRetData = castedReportedPosts.map((reportedPost) => {
      return {
        post: omit(reportedPost, 'ins'),
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

  @Delete('/report/post/:postID')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async deletePostFromINS(
    @Param('postID') postID: string,
    @PrismaUser('id') userID: string,
    @Body() data: DeletePostFromINSAPI,
  ) {
    this.logger.log(
      `Deciding action for reported post ${postID} by admin user ${userID}`,
    );

    const post = await this.postService.post({
      id: postID,
    });
    if (!post?.reportedAt) {
      this.logger.error(`Post is no longer reported in ins ${post?.insId}!`);
      throw new BadRequestException('Post is no longer reported in INS!');
    }
    const isAdmin = await this.insAdminService.isAdmin(userID, post?.insId);
    if (!isAdmin) {
      this.logger.error(
        `You're not allowed to delete post from ins ${post.insId}!`,
      );
      throw new BadRequestException(
        "You're not allowed to delete post from this INS!",
      );
    }

    if (data.isDeleted) {
      this.logger.log(`Deleting post ${postID} by admin user ${userID}`);
      const post = await this.postService.deletePost(
        {
          id: postID,
        },
        {
          mediaContent: {
            include: {
              posts: true,
            },
          },
        },
      );

      this.logger.log(
        `Removing media from post ${postID} by admin user ${userID} if not has any other related post`,
      );
      const castedPost = <
        PostModel & {
          mediaContent: (PostContent & {
            posts: PostModel[];
          })[];
        }
      >post;
      const deletedMediasIDs: string[] = [];
      castedPost.mediaContent.map((media) => {
        if (media.posts.length === 1) {
          deletedMediasIDs.push(media.id);
        }
      });

      await this.mediaService.deleteMany({
        where: {
          id: {
            in: deletedMediasIDs,
          },
        },
      });

      if (post.authorId && post.authorId !== userID) {
        this.logger.log(
          `Creating notification for removing post ${postID} by admin user ${userID}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.DELETED_POST_BY_ADMIN,
          targets: {
            connect: {
              id: post.authorId,
            },
          },
          author: {
            connect: {
              id: userID,
            },
          },
          ins: {
            connect: {
              id: post.insId,
            },
          },
        });
      }

      return omit(castedPost, 'mediaContent');
    } else {
      this.logger.log(
        `Removing reporting for post ${postID} by admin user ${userID}`,
      );
      return this.postService.updatePost({
        where: {
          id: postID,
        },
        data: {
          reportedAt: null,
          reportedByUsers: [],
        },
      });
    }
  }

  @Delete('/report/posts')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async deleteReportedPosts(@PrismaUser('id') userID: string) {
    this.logger.log(`Deleting all reported posts by admin user ${userID}`);

    const insesAdmin = await this.insService.inses({
      where: {
        members: {
          some: {
            userId: userID,
            role: UserRole.ADMIN,
          },
        },
      },
    });

    const deletedPosts = await this.postService.posts({
      where: {
        insId: {
          in: insesAdmin.map((ins) => ins.id),
        },
        reportedAt: {
          not: null,
        },
      },
      include: {
        mediaContent: {
          include: {
            posts: true,
          },
        },
      },
    });

    await this.postService.deleteManyPosts({
      where: {
        insId: {
          in: insesAdmin.map((ins) => ins.id),
        },
        reportedAt: {
          not: null,
        },
      },
    });

    this.logger.log(
      `Removing media from post ${deletedPosts.map(
        (post) => post.id,
      )} by admin user ${userID} if not has any other related post`,
    );
    const castedDeletedPosts = <
      (PostModel & {
        mediaContent: (PostContent & {
          posts: PostModel[];
        })[];
      })[]
    >deletedPosts;
    const deletedMediasIDs: string[] = [];
    castedDeletedPosts.map((post) => {
      post.mediaContent.map((media) => {
        if (media.posts.length === 1) {
          deletedMediasIDs.push(media.id);
        }
      });
    });

    await this.mediaService.deleteMany({
      where: {
        id: {
          in: deletedMediasIDs,
        },
      },
    });

    await Promise.all(
      deletedPosts.map(async (post) => {
        if (post.authorId && post.authorId !== userID) {
          this.logger.log(
            `Creating notification for removing post ${post.id} by admin user ${userID}`,
          );
          await this.notificationService.createNotification({
            source: NotificationSource.DELETED_POST_BY_ADMIN,
            targets: {
              connect: {
                id: post.authorId,
              },
            },
            author: {
              connect: {
                id: userID,
              },
            },
            ins: {
              connect: {
                id: post.insId,
              },
            },
          });
        }
      }),
    );

    this.logger.log('Posts succesffully deleted by admin ins');
    return {
      message: 'Posts succesffully deleted by admin ins',
    };
  }
}
