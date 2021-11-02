import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
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
  InviteTestMessageAPI,
  InviteUserToINSAPI,
} from './invite-api.entity';
import { InviteService } from './invite.service';

@Controller('invite')
export class InviteController {
  private readonly logger = new Logger(InviteController.name);

  constructor(private readonly inviteService: InviteService) {}

  // invite by phone number, invite by user id

  @Post('ins-users')
  @UseGuards(JwtAuthGuard)
  @ApiTags('invite')
  async inviteInsUser(
    @PrismaUser('id') userID: string,
    @Body() body: InviteUserToINSAPI,
  ) {
    this.logger.log(
      `Inviting users ${body.userIDs} in ins ${body.ins} by user ${userID}`,
    );
    await this.inviteService.inviteINSUser(userID, body.userIDs, body.ins);

    this.logger.log('Invited successfully');
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
    this.logger.log(
      `Inviting external phone numbers ${body.phoneNumbers} in ins ${body.ins} by user ${userID}`,
    );
    await this.inviteService.inviteExternalUser(
      userID,
      body.phoneNumbers,
      body.ins,
    );

    this.logger.log('Invited successfully');
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
    @Query('ins') insID: string,
  ) {
    if (Number.isNaN(skip) || Number.isNaN(take)) {
      this.logger.error('Invalid skip / take values!');
      throw new BadRequestException('Invalid skip / take values!');
    }
    if (allNumber != 0 && allNumber != 1) {
      this.logger.error('Invalid all param!');
      throw new BadRequestException('Invalid all param!');
    }
    if (!insID) {
      this.logger.error('Must specify INS!');
      throw new BadRequestException('Must specify INS!');
    }

    this.logger.log(`Searching for invited users by user ${userID}`);
    return this.inviteService.invitesList(
      allNumber === 1,
      skip,
      take,
      search,
      userID,
      insID,
    );
  }

  @Post('test-message')
  @ApiTags('invite')
  async testMessage(@Body() body: InviteTestMessageAPI) {
    this.logger.log(
      `Test message '${body.message}' sended for phone ${body.phoneNumber}`,
    );
    await this.inviteService.testMessage(body);

    this.logger.log('Tested successfully');
    return {
      message: 'Tested successfully!',
    };
  }
}
