import { Controller, Logger, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaUser } from 'src/decorators/user.decorator';
import { UserConnectionService } from 'src/user/user.connection.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('ins')
export class InsPinController {
  private readonly logger = new Logger(InsPinController.name);

  constructor(private readonly userConnectionService: UserConnectionService) {}

  @Patch(':id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async pinINS(@PrismaUser('id') userID: string, @Param('id') insID: string) {
    this.logger.log(`Pinning ins ${insID} for user ${userID}`);
    return this.userConnectionService.updatePinned(userID, insID, true);
  }

  @Patch(':id/unpin')
  @UseGuards(JwtAuthGuard)
  @ApiTags('ins')
  async unpinINS(@PrismaUser('id') userID: string, @Param('id') insID: string) {
    this.logger.log(`Unpinning ins ${insID} for user ${userID}`);
    return this.userConnectionService.updatePinned(userID, insID, false);
  }
}
