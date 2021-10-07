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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import {
  InviteExternalUserToINSAPI,
  InviteUserToINSAPI,
} from './invite-api.entity';
import { InviteService } from './invite.service';

@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // invite by phone number, invite by user id

  @Post('ins-users')
  @UseGuards(JwtAuthGuard)
  @ApiTags('invite')
  async inviteInsUser(
    @PrismaUser('id') userID: string,
    @Body() body: InviteUserToINSAPI,
  ) {
    return this.inviteService.inviteINSUser(userID, body.userIDs, body.ins);
  }

  @Post('external-users')
  @UseGuards(JwtAuthGuard)
  @ApiTags('invite')
  async inviteExternalUser(
    @PrismaUser('id') userID: string,
    @Body() body: InviteExternalUserToINSAPI,
  ) {
    return this.inviteService.inviteExternalUser(
      userID,
      body.phoneNumbers,
      body.ins,
    );
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
    @Query('ins') insID: string,
  ) {
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      throw new BadRequestException('Invalid skip / take values!');
    }
    if (allNumber != 0 && allNumber != 1) {
      throw new BadRequestException('Invalid all param!');
    }
    if (!insID) {
      throw new BadRequestException('Must specify INS!');
    }
    return this.inviteService.invitesList(
      allNumber === 1,
      skip,
      take,
      search,
      userID,
      insID,
    );
  }
}
