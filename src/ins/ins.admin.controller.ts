import {
  Body,
  Controller,
  Delete,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserConnectionService } from 'src/user/user.connection.service';
import { UpdateINSAdminAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsService } from './ins.service';

@Controller('ins/admin')
export class InsAdminController {
  private readonly logger = new Logger(InsAdminController.name);

  constructor(
    private readonly insAdminService: InsAdminService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Post('/change')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async changeINSAdmin(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    this.logger.log(`Changing admin for ins ${data.insID}`);

    this.logger.log(
      `Checking if user ${userID} is admin for ins ${data.insID}`,
    );
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      throw new UnauthorizedException(
        "You're not allowed to change INS admin!",
      );
    }

    this.logger.log(
      `Removing all admins for ins ${data.insID} and changing user ${data.memberID} as admin`,
    );
    return this.insAdminService.changeAdmin(data.insID, data.memberID);
  }

  @Delete('/remove-member')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async removeMemberFromINS(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    this.logger.log(
      `Checking if user ${userID} is admin for ins ${data.insID}`,
    );
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      console.log(
        `Allowing random user to remove member cuz he's such a nice guy! But also for testing.`,
      );
      // throw new UnauthorizedException(
      //   "You're not allowed to remove members from INS!",
      // );
    }

    this.logger.log(`Removing member ${data.memberID} from ins ${data.insID}`);
    return this.userConnectionService.removeMember({
      userId_insId: {
        userId: data.memberID,
        insId: data.insID,
      },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins-admin')
  async deleteINS(
    @Param('id') insID: string,
    @PrismaUser('id') userID: string,
  ) {
    this.logger.log(`Checking if ins ${insID} exists before deleting it`);
    const ins = await this.insService.ins({
      id: insID,
    });
    if (!ins) {
      throw new NotFoundException('Could not find this INS!');
    }

    this.logger.log(`Checking if user ${userID} is admin for ins ${insID}`);
    const isAdmin = await this.insAdminService.isAdmin(userID, insID);
    if (!isAdmin) {
      throw new UnauthorizedException("You're not allowed to delete this INS!");
    }

    this.logger.log(`Deleting ins ${insID}`);
    return this.insAdminService.deleteINS({ id: insID });
  }
}
