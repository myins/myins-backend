import { UserRole } from '.prisma/client';
import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import { ApproveDenyUserAPI } from './user-api.entity';

@Controller('user/pending')
@UseInterceptors(NotFoundInterceptor)
export class UserPendingController {
  constructor(
    private readonly userService: UserService,
    private readonly insService: InsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async getPendingUsers(
    @PrismaUser('id') id: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    return this.userService.users({
      where: {
        inses: {
          some: {
            ins: {
              members: {
                some: {
                  userId: id,
                  OR: [
                    {
                      role: 'MEMBER',
                    },
                    {
                      role: 'ADMIN',
                    },
                  ],
                },
              },
            },
            role: 'PENDING',
            OR: [
              {
                deniedByUsers: {
                  equals: null,
                },
              },
              {
                NOT: {
                  deniedByUsers: {
                    has: id,
                  },
                },
              },
            ],
          },
        },
      },
      skip: skip,
      take: take,
    });
  }

  @Patch('approve')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async approve(
    @PrismaUser('id') id: string,
    @Body() data: ApproveDenyUserAPI,
  ) {
    const connection = await this.insService.getConnection(id, data.insID);
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

    await this.userService.approveUser(data.userID, data.insID);
    return {
      message: 'Member approved!',
    };
  }

  @Patch('deny')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async deny(@PrismaUser('id') id: string, @Body() data: ApproveDenyUserAPI) {
    const connection = await this.insService.getConnection(id, data.insID);
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to deny members for this INS!",
      );
    }

    await this.userService.denyUser(id, data.userID, data.insID);
    return {
      message: 'Member denied!',
    };
  }
}
