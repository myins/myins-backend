import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UpdateINSAdminAPI } from './ins-api.entity';
import { InsAdminService } from './ins.admin.service';

@Controller('ins/admin')
export class InsAdminController {
  constructor(private readonly insAdminService: InsAdminService) { }

  @Post('/change')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async changeINSAdmin(@PrismaUser('id') userID: string, @Body() data: UpdateINSAdminAPI) {
      return this.insAdminService.changeAdmin(userID, data.insID, data.newAdminID)
  }
}
