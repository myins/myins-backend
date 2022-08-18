import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentVersionsService } from './current-versions.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('current-versions')
export class CurrentVersionsController {
  private readonly logger = new Logger(CurrentVersionsController.name);

  constructor(
    private readonly currentVersionsService: CurrentVersionsService,
  ) {}

  @Get('links')
  @UseGuards(JwtAuthGuard)
  @ApiTags('current-versions')
  async getLinks() {
    this.logger.log('Getting links for TC and PP');
    return this.currentVersionsService.getLinks();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('current-versions')
  async changeCurrentVersions(@Body() body: ChangeCurrentVersionsAPI) {
    this.logger.log(
      `Changing current version for document type ${body.documentType}`,
    );
    return this.currentVersionsService.changeDocumentVersion(body);
  }
}
