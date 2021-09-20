import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserService } from 'src/user/user.service';
import {
  InviteExternalUserToINSAPI,
  InviteUserToINSAPI,
} from './invite-api.entity';
import { InviteService } from './invite.service';

@Controller('invite')
export class InviteController {
  constructor(
    private readonly userService: UserService,
    private readonly inviteService: InviteService,
  ) {}

  // invite by phone number, invite by user id

  @Post('ins-users')
  @UseGuards(JwtAuthGuard)
  @ApiTags('invite')
  async inviteInsUser(
    @PrismaUser('id') userID: string,
    @Body() body: InviteUserToINSAPI,
  ) {
    await this.inviteService.inviteINSUser(userID, body.userIDs, body.ins);

    return {
      message: 'Invited successfully!',
    };
  }

  @Post('external-users')
  @UseGuards(JwtAuthGuard)
  @ApiTags('invite')
  async inviteExternalUser(
    @PrismaUser('id') userID: string,
    @Body() body: InviteExternalUserToINSAPI,
  ) {
    await this.inviteService.inviteExternalUser(
      userID,
      body.phoneNumbers,
      body.ins,
    );

    return {
      message: 'Invited successfully!',
    };
  }

  @Get('search')
  @ApiTags('invite')
  @UseGuards(JwtAuthGuard)
  @Throttle(60, 60) // limit, ttl. limit = cate request-uri pana crapa,  ttl = cat tine minte un request
  async getUserSearch(
    @PrismaUser('id') userID: string,
    @Query('all') allNumber: number,
    @Query('skip') skip: number,
    @Query('take') take: number,
    @Query('search') search: string,
  ) {
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      throw new BadRequestException('Invalid skip / take values!');
    }
    if (allNumber != 0 && allNumber != 1) {
      throw new BadRequestException('Invalid all param!');
    }

    const isAll = allNumber == 1;

    const profileInfo: Prisma.UserWhereInput = {
      OR:
        search && search.length > 0
          ? [
              {
                firstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      id: {
        not: userID,
      },
      inses: isAll
        ? undefined
        : {
            some: {
              ins: {
                members: {
                  some: {
                    userId: userID,
                  },
                },
              },
            },
          },
    };

    const toRet = await this.userService.shallowUsers({
      where: profileInfo,
      orderBy: [
        {
          firstName: 'desc',
        },
        {
          lastName: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: skip,
      take: take,
    });
    return toRet;
  }
}
