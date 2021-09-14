import {
  Body,
  Controller,
  Delete,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UpdateINSAdminAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';
import { InsInteractionService } from './ins.interaction.service';

@Controller('ins/admin')
export class InsAdminController {
  constructor(
    private readonly insAdminService: InsAdminService,
    private readonly insInteractionService: InsInteractionService,
  ) {}

  @Post('/change')
  @ApiTags('ins')
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
  @ApiTags('ins')
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
}
