import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SharePostAPI } from 'src/comment/comment-api.entity';
import { UserID } from 'src/decorators/user-id.decorator';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShallowUserSelect } from 'src/util/shallow-user';

@Controller('share')
export class ShareController {

    constructor(private readonly notificationService: NotificationService, private readonly prismaService: PrismaService) { }

    @Post('post')
    @UseGuards(JwtAuthGuard)
    @ApiTags('posts')
    async sharePost(
        @Body() postData: SharePostAPI,
        @UserID() userID: string,
    ) {
        const { postID, targetIDs } = postData;

        const allPromises = targetIDs.map(each => {
          return this.notificationService.createNotification({
            source: 'SHARED_POST',
            target: {
                connect: {
                    id: each,
                },
            },
            author: {
                connect: {
                    id: userID,
                },
            },
            post: {
                connect: {
                    id: postID,
                },
            },
        })
        })

        await Promise.all(allPromises)

        return {
            status: "ok"
        }
    }

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @Throttle(60, 60) // limit, ttl. limit = cate request-uri pana crapa,  ttl = cat tine minte un request
    async getFeed(
      @UserID() userID: string,
      @Query('skip') skip: number,
      @Query('take') take: number,
      @Query('search') search: string,
    ) {
      if (Number.isNaN(skip) || Number.isNaN(take)) {
        throw new BadRequestException('Invalid skip / take values!');
      }

      const profileInfo: Prisma.UserWhereInput = {
        OR: [
          {
            firstName: {
              contains: search,
              mode: 'insensitive'
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive'
            },
          },
        ],
        id: {
            not: userID
        }
      };

      //console.log(search.length > 0)
      const toRet = await this.prismaService.user.findMany({
          where: (search && search.length > 0) ? profileInfo : {},
          orderBy: {
              id: 'desc'
          },
          skip: skip,
          take: take,
          select: ShallowUserSelect
      })
      //console.log(toRet)
      return toRet
    }

}
