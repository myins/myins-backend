import { UserRole } from '.prisma/client';
import {
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { UserService } from 'src/user/user.service';
import { ApproveDenyUserAPI } from './user-api.entity';
import { UserConnectionService } from './user.connection.service';

@Controller('user/pending')
@UseInterceptors(NotFoundInterceptor)
export class UserPendingController {
  private readonly logger = new Logger(UserPendingController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async getPendingUsers(
    @PrismaUser('id') id: string,
    @Query('skip') skip: number,
    @Query('take') take: number,
  ) {
    this.logger.log(
      `Getting pending users for inses where user ${id} is a member`,
    );
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
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: id,
        insId: data.insID,
      },
    });
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to approve members for this INS!",
      );
    }

    this.logger.log(
      `Approving user ${data.userID} in ins ${data.insID} by user ${id}`,
    );
    return this.userService.approveUser(data.userID, data.insID);
  }

  @Patch('deny')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users-pending')
  async deny(@PrismaUser('id') id: string, @Body() data: ApproveDenyUserAPI) {
    const connection = await this.userConnectionService.getConnection({
      userId_insId: {
        userId: id,
        insId: data.insID,
      },
    });
    if (!connection || connection.role === UserRole.PENDING) {
      throw new UnauthorizedException(
        "You're not allowed to deny members for this INS!",
      );
    }

    this.logger.log(
      `Denying user ${data.userID} from ins ${data.insID} by user ${id}`,
    );
    return this.userService.denyUser(id, data.userID, data.insID);
  }
}
