import {
  Body,
  Controller,
  Delete,
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
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      throw new UnauthorizedException(
        "You're not allowed to change INS admin!",
      );
    }

    return this.insAdminService.changeAdmin(data.insID, data.memberID);
  }

  @Delete('/remove-member')
  @ApiTags('ins-admin')
  @UseGuards(JwtAuthGuard)
  async removeMemberFromINS(
    @PrismaUser('id') userID: string,
    @Body() data: UpdateINSAdminAPI,
  ) {
    const isAdmin = await this.insAdminService.isAdmin(userID, data.insID);
    if (!isAdmin) {
      throw new UnauthorizedException(
        "You're not allowed to remove members from INS!",
      );
    }

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
    const ins = await this.insService.ins({
      id: insID,
    });
    if (!ins) {
      throw new NotFoundException('Could not find this INS!');
    }
    const isAdmin = await this.insAdminService.isAdmin(userID, insID);
    if (!isAdmin) {
      throw new UnauthorizedException("You're not allowed to delete this INS!");
    }
    return this.insAdminService.deleteINS({ id: insID });
  }
}
