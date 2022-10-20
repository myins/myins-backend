import {
  INS,
  NotificationSource,
  UserInsConnection,
  UserRole,
} from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
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
import { StoryInsConnection } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { MediaService } from 'src/media/media.service';
import {
  NotificationPushService,
  PushExtraNotification,
  PushNotificationSource,
} from 'src/notification/notification.push.service';
import { NotificationService } from 'src/notification/notification.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UserService } from 'src/user/user.service';
import { photoInterceptor } from 'src/util/multer';
import { omit } from 'src/util/omit';
import { CreateINSAPI } from './ins-api.entity';
import { InsService } from './ins.service';

@Controller('ins')
export class InsController {
  private readonly logger = new Logger(InsController.name);

  constructor(
    private readonly insService: InsService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly notificationService: NotificationService,
    private readonly notificationPushService: NotificationPushService,
    private readonly mediaService: MediaService,
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
  async getInsByCode(@Param('code') insCode: string) {
    if (insCode.length <= 0) {
      this.logger.error(`Invalid code ${insCode}!`);
      throw new BadRequestException('Invalid code!');
    }

    this.logger.log(`Getting ins by code ${insCode}`);
    const inses = await this.insService.inses({
      where: {
        shareCode: insCode,
      },
      include: {
        members: {
          where: {
            role: {
              not: UserRole.PENDING,
            },
            user: {
              isDeleted: false,
            },
          },
        },
      },
    });
    let ins = inses[0];
    const castedIns = <
      INS & {
        _count: {
          members: number;
        };
        members: UserInsConnection[];
      }
    >ins;
    if (ins) {
      castedIns._count = {
        members: castedIns.members.length,
      };
      ins = omit(castedIns, 'members');

      this.logger.log('Successfully returned ins');
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
    @Query('withoutPending') withoutPending: boolean,
  ) {
    this.logger.log(
      `Getting ins list for user ${userID} with filter '${filter}'`,
    );
    return this.insService.insList(userID, filter, withoutPending);
  }

  @Get(':id/media')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getMediaByID(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @Query('onlyMine') onlyMine: boolean,
    @Query('unwrapped') unwrapped: boolean,
  ) {
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      this.logger.error('Invalid skip / take values!');
      throw new BadRequestException('Invalid skip / take values!');
    }

    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    this.logger.log(
      `Getting posts with all media for ins ${id} by user ${userID}`,
    );
    return this.insService.mediaForIns(
      userID,
      id,
      skip,
      take,
      onlyMine,
      unwrapped,
    );
  }

  @Get(':id/media-unwrapped')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getMediaUnwrappedByID(
    @Param('id') id: string,
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @Query('withoutVideos') withoutVideos: boolean,
  ) {
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      this.logger.error('Invalid skip / take values!');
      throw new BadRequestException('Invalid skip / take values!');
    }

    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    this.logger.log(`Getting media for ins ${id} by user ${userID}`);
    return this.mediaService.getMedias({
      where: {
        posts: {
          some: {
            insId: id,
          },
        },
        isVideo: withoutVideos ? false : undefined,
      },
      skip,
      take,
    });
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
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      this.logger.error('Invalid skip / take values!');
      throw new BadRequestException('Invalid skip / take values!');
    }

    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    this.logger.log(`Getting members for ins ${id} by user ${userID}`);
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
    const ins = await this.insService.ins({
      id: id,
    });
    if (!ins) {
      this.logger.error(`Could not find INS ${id}!`);
      throw new NotFoundException('Could not find that INS!');
    }

    const insWithoutInvitedPhoneNumbers = omit(ins, 'invitedPhoneNumbers');
    const connections = await this.userConnectionService.getConnections({
      where: {
        insId: insWithoutInvitedPhoneNumbers.id,
        userId: userID,
        role: {
          not: UserRole.PENDING,
        },
      },
      include: {
        ins: {
          include: {
            members: {
              where: {
                role: {
                  not: UserRole.PENDING,
                },
                user: {
                  isDeleted: false,
                },
              },
            },
            stories: {
              where: {
                story: {
                  mediaContent: {
                    some: {
                      views: {
                        none: {
                          id: userID,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!connections.length) {
      this.logger.error("You're not a member!");
      throw new BadRequestException("You're not a member!");
    }

    const connection = <
      UserInsConnection & {
        ins: INS & {
          members: UserInsConnection[];
          stories: StoryInsConnection[];
        };
      }
    >connections[0];
    const toRet = {
      ...insWithoutInvitedPhoneNumbers,
      _count: {
        members: connection.ins.members.length,
      },
      newStories: connection.ins.stories.length > 0,
      userRole: connection.role,
      isMute: !!connection.muteUntil,
    };

    return toRet;
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
      if (connection.role === UserRole.PENDING) {
        return {
          statusCode: 585858,
          message:
            'You already requested access to this INS. Please wait for approval!',
        };
      }
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

        const targetIDs = (
          await this.userConnectionService.getConnections({
            where: {
              insId: theINS.id,
              role: {
                not: UserRole.PENDING,
              },
            },
          })
        ).map((connection) => {
          return { id: connection.userId };
        });

        await this.notificationService.createNotification({
          source: NotificationSource.JOINED_INS,
          targets: {
            connect: targetIDs,
          },
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
        const insNotification: INS = {
          ...theINS,
          invitedPhoneNumbers: [],
        };

        this.logger.log(
          `Creating notification for pending ins ${insNotification.id} for user ${user.id}`,
        );
        await this.notificationService.createNotification({
          source: NotificationSource.PENDING_INS,
          targets: {
            connect: { id: user.id },
          },
          author: {
            connect: { id: user.id },
          },
          ins: {
            connect: {
              id: insNotification.id,
            },
          },
        });

        this.logger.log(
          `Creating push notification for requesting access in ins ${insNotification.id}`,
        );

        const targetIDs = (
          await this.userConnectionService.getConnections({
            where: {
              insId: insNotification.id,
              userId: {
                not: user.id,
              },
              role: {
                not: UserRole.PENDING,
              },
            },
          })
        ).map((connection) => connection.userId);

        const data: PushExtraNotification = {
          source: PushNotificationSource.REQUEST_FOR_OTHER_USER,
          author: await this.userService.shallowUser({ id: user.id }),
          ins: insNotification,
          targets: targetIDs,
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
    const updatedIns = await this.insService.attachCoverToPost(file, theINS.id);

    const connections = await this.userConnectionService.getConnections({
      where: {
        insId: updatedIns.id,
        userId: userID,
      },
      include: {
        ins: {
          include: {
            members: {
              where: {
                role: {
                  not: UserRole.PENDING,
                },
                user: {
                  isDeleted: false,
                },
              },
            },
          },
        },
      },
    });

    const connection = <
      UserInsConnection & {
        ins: INS & {
          members: UserInsConnection[];
        };
      }
    >connections[0];
    const toRet = {
      ...updatedIns,
      _count: {
        members: connection.ins.members.length,
      },
    };

    return toRet;
  }
}
