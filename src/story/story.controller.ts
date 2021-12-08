import { User, UserRole } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { CreateStoryAPI } from './story-api.entity';
import { StoryService } from './story.service';

@Controller('story')
export class StoryController {
  private readonly logger = new Logger(StoryController.name);

  constructor(
    private readonly storyService: StoryService,
    private readonly insService: InsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('story')
  async createPost(
    @Body() storyData: CreateStoryAPI,
    @PrismaUser() user: User,
  ) {
    if (!user.phoneNumberVerified) {
      this.logger.error(
        `Please verify phone ${user.phoneNumber} before creating stories!`,
      );
      throw new BadRequestException(
        'Please verify your phone before creating stories!',
      );
    }

    const mappedINSIDs = storyData.ins.map((each) => {
      return { id: each };
    });

    const inses = (
      await this.insService.insesSelectIDs({
        members: {
          some: {
            userId: user.id,
            role: {
              not: UserRole.PENDING,
            },
          },
        },
      })
    ).map((each) => each.id);

    for (const each of mappedINSIDs) {
      if (!inses.includes(each.id)) {
        this.logger.error("You're not allowed to post to that INS!");
        throw new BadRequestException(
          "You're not allowed to post to that INS!",
        );
      }
    }

    this.logger.log(
      `Creating story by user ${user.id} in inses ${mappedINSIDs.map(
        (ins) => ins.id,
      )}'`,
    );
    return this.storyService.createPost({
      author: {
        connect: {
          id: user.id,
        },
      },
      inses: {
        connect: mappedINSIDs,
      },
      isHighlight: storyData.isHighlight,
    });
  }
}
