import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { InsInteractionService } from './ins.interaction.service';

@Controller('ins')
export class InsController {
  constructor(private readonly insInteractionService: InsInteractionService) { }

  @Post(':id')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async interactWithIns(@UserID() userID: string, @Param('id') insID: string) {
      return this.insInteractionService.interact(userID, insID) 
  }
}
