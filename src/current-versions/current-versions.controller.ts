import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentVersionsService } from './current-versions.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Controller('current-versions')
export class CurrentVersionsController {
    constructor(
        private readonly currentVersionsService: CurrentVersionsService,
    ) { }
    
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiTags('current-versions')
    async changeCurrentVersions(@Body() body: ChangeCurrentVersionsAPI) {
        await this.currentVersionsService.changeDocumentVersion(body)
        return {
            message: "Terms and conditions version successfully changed."
        }
    }
}
