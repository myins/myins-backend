import { User, UserRole } from '.prisma/client';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { UserConnectionService } from 'src/user/user.connection.service';
import { CreateStoryAPI } from './story-api.entity';
import { StoryService } from './story.service';

@Controller('story')
export class StoryController {
  private readonly logger = new Logger(StoryController.name);

  constructor(
    private readonly storyService: StoryService,
    private readonly insService: InsService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiTags('story')
  async createStory(
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
        this.logger.error("You're not allowed to create story to that INS!");
        throw new BadRequestException(
          "You're not allowed to create story to that INS!",
        );
      }
    }

    this.logger.log(
      `Creating story by user ${user.id} in inses ${mappedINSIDs.map(
        (ins) => ins.id,
      )}'`,
    );
    return this.storyService.createStory({
      author: {
        connect: {
          id: user.id,
        },
      },
      inses: {
        connect: mappedINSIDs,
      },
      totalMediaContent: storyData.totalMediaContent,
    });
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiTags('story')
  async getFeed(
    @PrismaUser('id') userID: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    this.logger.log(`Getting stories feed for user ${userID}`);
    return this.storyService.getFeed(skip, take, userID);
  }

  @Get('feed/ins/:id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('story')
  async getStoriesForINS(
    @PrismaUser('id') userID: string,
    @Param('id') insID: string,
    @Query('take') take: number,
    @Query('skip') skip: number,
  ) {
    if (Number.isNaN(take) || Number.isNaN(skip)) {
      this.logger.error('Invalid skip / take!');
      throw new BadRequestException('Invalid skip / take!');
    }

    const connection = await this.userConnectionService.getNotPendingConnection(
      {
        userId_insId: {
          userId: userID,
          insId: insID,
        },
      },
    );
    if (!connection) {
      this.logger.error(`You're not a member of ins ${insID}!`);
      throw new BadRequestException("You're not a member of that ins!");
    }

    this.logger.log(`Getting stories feed for ins ${insID} by user ${userID}`);
    return this.storyService.getStoriesForINS(skip, take, userID, insID);
  }
}
