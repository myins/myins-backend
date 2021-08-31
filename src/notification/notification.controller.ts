import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get('feed')
  @ApiTags('notification')
  @UseGuards(JwtAuthGuard)
  async getFeed(
    @PrismaUser('id') userID: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    if (take > 20) {
      throw new BadRequestException("Don't get greedy!");
    }
    return this.notifService.getFeed(userID, skip, take);
  }


  // @Get('test')
  // async testFunction() {
  //   await this.notifService.pushSingleNotification({
  //     source: 'FOLLOW_ACCEPTED',
  //     target: {
  //       connect: {
  //         id: 70
  //       }
  //     },
  //     author: {
  //       connect: {
  //         id: 1
  //       }
  //     }
  //   })
  //   return {
  //     status: 'ok'
  //   }
  // }
}
