import { UserRole } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ChatService } from 'src/chat/chat.service';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UserService } from 'src/user/user.service';
import { photoInterceptor } from 'src/util/multer';
import { CreateINSAPI } from './ins-api.entity';
import { InsService } from './ins.service';

@Controller('ins')
export class InsController {
  private readonly logger = new Logger(InsController.name);

  constructor(
    private readonly insService: InsService,
    private readonly chatService: ChatService,
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
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
      throw new UnauthorizedException("You're not allowed to do this!");
    }
    if (!user?.phoneNumberVerified && userID) {
      throw new UnauthorizedException("You're not allowed to do this!");
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
      throw new BadRequestException('Invalid code!');
    }

    this.logger.log(`Getting ins by code ${insCode}`);
    return this.insService.ins({
      shareCode: insCode,
    });
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
      throw new BadRequestException('Could not find that INS!');
    }

    this.logger.log(`Getting media for ins ${id}`);
    return this.insService.mediaForIns(id, skip, take);
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
      throw new BadRequestException('Could not find that INS!');
    }

    this.logger.log(`Getting members for ins ${id}`);
    return this.insService.membersForIns(id, skip, take, filter);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async getByID(@Param('id') id: string, @PrismaUser('id') userID: string) {
    this.logger.log(`Getting ins by id ${id}`);
    const inses = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
    if (!inses || inses.length !== 1) {
      throw new BadRequestException('Could not find that INS!');
    }
    return inses[0];
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
      throw new BadRequestException('Invalid code!');
    }
    const theINS = await this.insService.ins({
      shareCode: insCode,
    });
    if (!theINS) {
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

    this.logger.log(`Adding user ${userID} as member in ins ${theINS.id}`);
    await this.insService.update({
      where: { id: theINS.id },
      data: {
        members: {
          create: {
            userId: userID,
          },
        },
      },
    });

    this.logger.log(
      `Adding stream user ${userID} as member in channel ${theINS.id}`,
    );
    await this.chatService.addMembersToChannel([userID], theINS.id);

    this.logger.log('Joined the INS');
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
      throw new BadRequestException('Could not find picture file!');
    }
    const validINS = await this.insService.inses({
      where: {
        id: insID,
        members: {
          some: {
            userId: userID,
          },
        },
      },
    });

    if (!validINS || validINS.length != 1) {
      throw new BadRequestException('Not your ins!!');
    }
    const theINS = validINS[0];

    this.logger.log(`Attach cover with name '${file.originalname}'`);
    return this.insService.attachCoverToPost(file, theINS.id);
  }
}
