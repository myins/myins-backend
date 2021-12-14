import {
  Controller,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { MediaService } from './media.service';

@Controller('media')
export class MediaConnectionsController {
  private readonly logger = new Logger(MediaConnectionsController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async viewMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`View story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    this.logger.log(
      `Updating story media ${mediaID}. Adding view connection with user ${userID}`,
    );
    return this.mediaService.updateMedia({
      where: { id: mediaID },
      data: {
        views: {
          connect: {
            id: userID,
          },
        },
      },
    });
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async likeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Like story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    this.logger.log(
      `Updating story media ${mediaID}. Adding like connection with user ${userID}`,
    );
    return this.mediaService.updateMedia({
      where: { id: mediaID },
      data: {
        likes: {
          connect: {
            id: userID,
          },
        },
      },
    });
  }

  @Post(':id/unlike')
  @UseGuards(JwtAuthGuard)
  @ApiTags('media')
  async unlikeMedia(
    @PrismaUser('id') userID: string,
    @Param('id') mediaID: string,
  ) {
    this.logger.log(`Unlike story media ${mediaID} by user ${userID}`);
    const media = await this.mediaService.getMediaById({
      id: mediaID,
    });
    if (!media) {
      this.logger.error(`Could not find story media ${mediaID}!`);
      throw new NotFoundException('Could not find this story media!');
    }

    this.logger.log(
      `Updating story media ${mediaID}. Deleting like connection with user ${userID}`,
    );
    return this.mediaService.updateMedia({
      where: { id: mediaID },
      data: {
        likes: {
          disconnect: {
            id: userID,
          },
        },
      },
    });
  }
}
