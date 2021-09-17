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
import { UpdateINSAdminAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsService } from './ins.service';

@Controller('ins/admin')
export class InsAdminController {
  constructor(
    private readonly insAdminService: InsAdminService,
    private readonly insService: InsService,
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

    await this.insAdminService.changeAdmin(data.insID, data.memberID);
    return {
      message: 'Admin changed!',
    };
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

    await this.insAdminService.removeMember(data.insID, data.memberID);
    return {
      message: 'Member removed from INS!',
    };
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
    return this.insAdminService.deleteINS(insID);
  }
}
