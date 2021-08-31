import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserService } from 'src/user/user.service';
import { InviteExternalUserToINSAPI, InviteUserToINSAPI } from './invite-api.entity';
import { InviteService } from './invite.service';

@Controller('invite')
export class InviteController {

    constructor(private readonly userService: UserService, private readonly inviteService: InviteService) { }

    // invite by phone number, invite by user id

    @Post('ins-user')
    @UseGuards(JwtAuthGuard)
    async inviteInsUser(
        @PrismaUser('id') userID: string,
        @Body() body: InviteUserToINSAPI,
    ) {
        await this.inviteService.inviteINSUser(userID, body.userID, body.ins)

        return {
            message: "Invited successfully!"
        }
    }

    @Post('external-user')
    @UseGuards(JwtAuthGuard)
    async inviteExternalUser(
        @PrismaUser('id') userID: string,
        @Body() body: InviteExternalUserToINSAPI,
    ) {
        await this.inviteService.inviteINSUser(userID, body.phoneNumber, body.ins)

        return {
            message: "Invited successfully!"
        }
    }

    @Get('search')
    @ApiTags('share')
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
            throw new BadRequestException("Invalid all param!")
        }

        const isAll = allNumber == 1

        const profileInfo: Prisma.UserWhereInput = {
            OR: (search && search.length > 0) ? [
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
            ] : undefined,
            id: {
                not: userID
            },
            inses: isAll ? undefined : {
                some: {
                    ins: {
                        members: {
                            some: {
                                userId: userID
                            }
                        }
                    }
                }
            }
        };

        const toRet = await this.userService.shallowUsers({
            where: profileInfo,
            orderBy: {
                firstName: 'desc'
            },
            skip: skip,
            take: take,
        })
        return toRet
    }

}
