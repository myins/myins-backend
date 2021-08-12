import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { CreateINSAPI } from './ins-api.entity';
import { InsService } from './ins.service';

@Controller('ins')
export class InsController {
    constructor(private readonly insService: InsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    async createINS(@UserID() userID: string, @Body() data: CreateINSAPI) {
        return this.insService.createINS(userID, data)
    }
}
