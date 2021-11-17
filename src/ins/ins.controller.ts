import { INS, NotificationSource, UserRole } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChatService } from 'src/chat/chat.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import {
  NotificationPushService,
  PushExtraNotification,
  PushNotificationSource,
} from 'src/notification/notification.push.service';
import { NotificationService } from 'src/notification/notification.service';
import {
  ConnectionIncludeMembers,
  ConnectionIncludeMembersInclude,
} from 'src/prisma-queries-helper/connection-include-members';
import { InsWithCountMembers } from 'src/prisma-queries-helper/ins-include-count-members';
import { InsWithMembersID } from 'src/prisma-queries-helper/ins-include-member-id';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UserService } from 'src/user/user.service';
import { photoInterceptor } from 'src/util/multer';
import { omit } from 'src/util/omit';
import { CreateINSAPI, LeaveINSAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsService } from './ins.service';

@Controller('ins')
export class InsController {
  private readonly logger = new Logger(InsController.name);

  constructor(
    private readonly insService: InsService,
    private readonly insAdminService: InsAdminService,
    private readonly chatService: ChatService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly notificationService: NotificationService,
    private readonly notificationPushService: NotificationPushService,
  ) {}

  @Post()
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async createINS(
    @PrismaUser('id') userID: string,
    @Body() data: CreateINSAPI,
  ) {
    const user = userID ? await this.userService.user({ id: userID }) : null;
    if (!user && userID) {
      this.logger.error(`Could not find user ${userID}!`);
      throw new NotFoundException('Could not find this user!');
    }
    if (!user?.phoneNumberVerified && userID) {
      this.logger.error(
        `You must verify phone ${user?.phoneNumber} before creating an INS!`,
      );
      throw new BadRequestException(
        'You must verify your phone before creating an INS!',
      );
    }

    this.logger.log(`Creating ins with name '${data.name}' by user ${userID}`);
    return this.insService.createINS({
      name: data.name,
      shareCode: await this.insService.randomCode(),
      members: {
        create: {
          userId: userID,
          role: UserRole.ADMIN,
        },
      },
    });
  }

  @Get('code/:code')
  //@Throttle(1,60) // FIXME: re-add this throttle for prod
  @ApiTags('ins')
  @UseInterceptors(NotFoundInterceptor)
  //@UseGuards(JwtAuthGuard)
  async getInsByCode(@Param('code') insCode: string) {
    if (insCode.length <= 0) {
      this.logger.error(`Invalid code ${insCode}!`);
      throw new BadRequestException('Invalid code!');
    }

    this.logger.log(`Getting ins by code ${insCode}`);
    let ins = await this.insService.ins(
      {
        shareCode: insCode,
      },
      {
        members: {
          where: {
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      },
    );
    if (ins) {
      (<InsWithCountMembers>ins)._count = {
        members: (<InsWithMembersID>ins).members.length,
      };
      ins = omit(<InsWithMembersID>ins, 'members');
      return ins;
    }
    this.logger.error(`Could not find ins with code ${insCode}!`);
    throw new NotFoundException('Could not find ins with that code!');
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getINSList(
    @PrismaUser('id') userID: string,
    @Query('filter') filter: string,
  ) {
    this.logger.log(
      `Getting ins list for user ${userID} with filter '${filter}'`,
    );
    return this.insService.insList(userID, filter);
  }

  @Get(':id/media')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getMediaByID(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    this.logger.log(`Getting posts with all media for ins ${id}`);
    return this.insService.mediaForIns(userID, id, skip, take);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getINSMembers(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @Query('filter') filter: string,
    @Query('without') without?: boolean,
  ) {
    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    this.logger.log(`Getting members for ins ${id}`);
    return this.insService.membersForIns(
      id,
      userID,
      skip,
      take,
      filter,
      without,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getByID(@Param('id') id: string, @PrismaUser('id') userID: string) {
    this.logger.log(`Getting ins by id ${id}`);
    const connections = await this.userConnectionService.getConnections({
      where: {
        insId: id,
        userId: userID,
      },
      include: ConnectionIncludeMembersInclude,
    });
    if (!connections || connections.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    const connection = <ConnectionIncludeMembers>connections[0];
    const insConnection = connection.ins;
    const insWithoutMembers = omit(<InsWithMembersID>insConnection, 'members');
    const ins: InsWithCountMembers = {
      ...insWithoutMembers,
      _count: {
        members: 0,
      },
    };
    ins._count = {
      members: insConnection.members.length,
    };
    const insWithoutInvitedPhoneNumbers = omit(ins, 'invitedPhoneNumbers');
    const retIns = {
      ...insWithoutInvitedPhoneNumbers,
      userRole: connection.role,
    };

    this.logger.log(
      `Create channel for ins ${id} by user stream ${userID} if not exists`,
    );
    await this.chatService.createChannelINSWithMembersIfNotExists(ins, userID);

    return retIns;
  }

  @Post('join/:code')
  //@Throttle(1,60) // FIXME: re-add this throttle for prod
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async joinInsByCode(
    @Param('code') insCode: string,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Trying user ${userID} to join group with code ${insCode}`);
    if (insCode.length <= 0) {
      this.logger.error(`Invalid code ${insCode}!`);
      throw new BadRequestException('Invalid code!');
    }
    const theINS = await this.insService.ins(
      {
        shareCode: insCode,
      },
      undefined,
      true,
    );
    if (!theINS) {
      this.logger.error(`Invalid code ${insCode}!`);
      throw new BadRequestException('Invalid ins code!');
    }

    this.logger.log(
      `Checking if user ${userID} already a member of ins ${theINS.id}`,
    );
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: userID,
        insId: theINS.id,
      },
    });
    if (connection) {
      return {
        statusCode: 585858,
        message: 'Already in INS!',
      };
    }

    const user = await this.userService.user({ id: userID });
    if (user?.phoneNumber) {
      if (theINS.invitedPhoneNumbers?.includes(user.phoneNumber)) {
        this.logger.log(`Adding new user ${user.id} in ins ${theINS.id}`);
        await this.insService.addInvitedExternalUserIntoINSes(
          [theINS],
          user.id,
          user.phoneNumber,
        );

        this.logger.log(
          `Creating notification for joining ins ${theINS.id} by user ${user.id}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.JOINED_INS,
          author: {
            connect: {
              id: user.id,
            },
          },
          ins: {
            connect: {
              id: theINS.id,
            },
          },
        });

        this.logger.log('Joined the INS');
      } else {
        this.logger.log(
          `Adding user ${userID} as pending member in ins ${theINS.id}`,
        );
        await this.insService.update({
          where: { id: theINS.id },
          data: {
            members: {
              create: {
                userId: userID,
                role: UserRole.PENDING,
              },
            },
          },
        });
        const insForPushNotification: INS = {
          ...theINS,
          invitedPhoneNumbers: [],
        };
        const data: PushExtraNotification = {
          source: PushNotificationSource.REQUEST_FOR_OTHER_USER,
          author: await this.userService.shallowUser({ id: user.id }),
          ins: insForPushNotification,
        };
        await this.notificationPushService.pushNotification(data);

        this.logger.log('Joined the INS as pending member');
      }
    }
    return {
      message: 'Joined the INS!',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/updateCover')
  @ApiTags('ins')
  @UseInterceptors(photoInterceptor)
  async updateCover(
    @PrismaUser('id') userID: string,
    @Param('id') insID: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    this.logger.log(`Update cover for ins ${insID} by user ${userID}`);
    if (!file) {
      this.logger.error('Could not find picture file!');
      throw new NotFoundException('Could not find picture file!');
    }
    const validINS = await this.insService.inses({
      where: {
        id: insID,
        members: {
          some: {
            userId: userID,
            role: UserRole.ADMIN,
          },
        },
      },
    });

    if (!validINS || validINS.length != 1) {
      this.logger.error('Not your ins!!');
      throw new BadRequestException('Not your ins!!');
    }
    const theINS = validINS[0];

    this.logger.log(`Attach cover with name '${file.originalname}'`);
    let updatedIns = await this.insService.attachCoverToPost(file, theINS.id);
    const updateInsWithoutInvitedPhoneNumbers = omit(
      updatedIns,
      'invitedPhoneNumbers',
    );
    (<InsWithCountMembers>updateInsWithoutInvitedPhoneNumbers)._count = {
      members: (<InsWithMembersID>updateInsWithoutInvitedPhoneNumbers).members
        .length,
    };
    updatedIns = omit(
      <InsWithMembersID>updateInsWithoutInvitedPhoneNumbers,
      'members',
    );
    return updatedIns;
  }

  @Delete('/:id/leave')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async leaveINS(
    @PrismaUser('id') userId: string,
    @Param('id') insId: string,
    data: LeaveINSAPI,
  ) {
    const user = await this.userService.user({
      id: userId,
    });
    if (!user) {
      this.logger.error(`Could not find user ${userId}!`);
      throw new NotFoundException('Could not find this user!');
    }

    this.logger.log(`Checking if user ${userId} is admin for ins ${insId}`);
    const isAdmin = await this.insAdminService.isAdmin(userId, insId);
    let message = 'User cannot be deleted because is admin!';

    if (!isAdmin) {
      this.logger.log(`User ${userId} is not an admin for ins ${insId}`);
      if (!data.keepData) {
        await this.insService.cleanMedia(userId, insId);
      }

      this.logger.log(`Removing member ${userId} from ins ${insId}`);
      await this.userConnectionService.removeMember({
        userId_insId: {
          insId: insId,
          userId: userId,
        },
      });
      message = 'User successfully removed from ins';
      this.logger.log(message);
    }

    return {
      isAdmin: isAdmin,
      message: message,
    };
  }
}
