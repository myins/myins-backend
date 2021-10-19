import { Controller, Logger, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InteractionService } from './interaction.service';

@Controller('interact')
export class InteractionController {
  private readonly logger = new Logger(InteractionController.name);

  constructor(private readonly interactionService: InteractionService) {}

  @Patch('ins/:id')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async interactWithIns(
    @PrismaUser('id') userID: string,
    @Param('id') insID: string,
  ) {
    this.logger.log(
      `Incrementing interaction between user ${userID} and ins ${insID}`,
    );
    await this.interactionService.interact(userID, insID);

    this.logger.log('Interaction with ins successfully added');
    return {
      message: 'Interaction with ins successfully added',
    };
  }

  @Patch('post/:id')
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async interactWithPost(
    @PrismaUser('id') userID: string,
    @Param('id') postID: string,
  ) {
    this.logger.log(
      `Adding interaction for user ${userID} when accessing post ${postID}`,
    );
    await this.interactionService.interactPost(userID, postID);

    this.logger.log('Interaction with post successfully added');
    return {
      message: 'Interaction with post successfully added',
    };
  }
}
