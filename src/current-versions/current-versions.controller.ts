import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentVersionsService } from './current-versions.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Controller('current-versions')
export class CurrentVersionsController {
  constructor(
    private readonly currentVersionsService: CurrentVersionsService,
  ) {}

  @Get('links')
  @UseGuards(JwtAuthGuard)
  @ApiTags('current-versions')
  async getLinks() {
    return this.currentVersionsService.getLinks();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('current-versions')
  async changeCurrentVersions(@Body() body: ChangeCurrentVersionsAPI) {
    return this.currentVersionsService.changeDocumentVersion(body);
  }
}
