import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { CurrentVersions as CurrentVersionsModel } from '@prisma/client';
import { CurrentVersionsService } from './current-versions.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Controller('current-versions')
export class CurrentVersionsController {
    constructor(
        private readonly currentVersionsService: CurrentVersionsService,
    ) { }
    
    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiTags('current-versions')
    async getPostById(@Param('id') id: string, @PrismaUser('id') userID: string): Promise<CurrentVersionsModel | null> {
        return this.currentVersionsService.get()
    }
    
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiTags('current-versions')
    async changeCurrentVersions(@Body() body: ChangeCurrentVersionsAPI) {
        this.currentVersionsService.changeTermsAndConditionsVersion(body)

        return {
            message: "Terms and conditions version successfully changed."
        }
    }
}
