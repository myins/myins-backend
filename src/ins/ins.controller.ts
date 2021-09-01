import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import * as path from 'path';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { photoInterceptor } from 'src/util/multer';
import { CreateINSAPI } from './ins-api.entity';
import { InsService } from './ins.service';

@Controller('ins')
export class InsController {
  constructor(private readonly insService: InsService, private readonly storageService: StorageService) { }

  @Post()
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async createINS(@PrismaUser('id') userID: string, @Body() data: CreateINSAPI) {
    return this.insService.createINS(userID, data)
  }

  @Get('code/:code')
  //@Throttle(1,60) // FIXME: re-add this throttle for prod
  @ApiTags('ins')
  @UseInterceptors(NotFoundInterceptor)
  //@UseGuards(JwtAuthGuard)
  async getInsByCode(@Param('code') insCode: string) {
    if (insCode.length <= 0) {
      throw new BadRequestException("Invalid code!")
    }
    return this.insService.ins({
      shareCode: insCode
    })
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async getINSList(@PrismaUser('id') userID: string, @Query('skip') skip: number, @Query('take') take: number, @Query('filter') filter: string) {
    return this.insService.insList(userID, filter);
  }

  @Get(':id/media')
  @UseGuards(JwtAuthGuard)
  async getMediaByID(@Param('id') id: string, @PrismaUser('id') userID: string, @Query('skip') skip: number, @Query('take') take: number) {
    const toRet = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID
          }
        }
      }
    })
    if (!toRet || toRet.length !== 1) {
      throw new BadRequestException("Could not find that INS!")
    }

    return this.insService.mediaForIns(id, skip, take)
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getINSMembers(@Param('id') id: string, @PrismaUser('id') userID: string, @Query('skip') skip: number, @Query('take') take: number, @Query('filter') filter: string) {
    const toRet = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID
          }
        }
      }
    })
    if (!toRet || toRet.length !== 1) {
      throw new BadRequestException("Could not find that INS!")
    }

    return this.insService.membersForIns(id, skip, take, filter)
  }


  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getByID(@Param('id') id: string, @PrismaUser('id') userID: string) {
    const toRet = await this.insService.inses({
      where: {
        id: id,
        members: {
          some: {
            userId: userID
          }
        }
      },
      include: {
        _count: {
          select: {
            members: true
          }
        }
      }
    })
    if (!toRet || toRet.length !== 1) {
      throw new BadRequestException("Could not find that INS!")
    }
    return toRet[0]
  }


  @Post('join/:code')
  //@Throttle(1,60) // FIXME: re-add this throttle for prod
  @ApiTags('ins')
  @UseGuards(JwtAuthGuard)
  async joinInsByCode(@Param('code') insCode: string, @PrismaUser('id') userID: string) {
    if (insCode.length <= 0) {
      throw new BadRequestException("Invalid code!")
    }
    const theINS = await this.insService.ins({
      shareCode: insCode
    })
    if (!theINS) {
      throw new BadRequestException("Invalid ins code!")
    }
    await this.insService.update({
      where: { id: theINS.id }, data: {
        members: {
          create: {
            userId: userID
          }
        }
      }
    })
    return {
      message: "Joined the INS!"
    }
  }


  @UseGuards(JwtAuthGuard)
  @Post(':id/updateCover')
  @ApiTags('ins')
  @UseInterceptors(photoInterceptor)
  async updateCover(
    @PrismaUser('id') userID: string,
    @Param('id') insID: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Could not find picture file!');
    }
    const insToRet = await this.insService.ins({ id: insID })
    if (!insToRet) {
      throw new NotFoundException('Could not find user :(');
    }
    const randomString = crypto.randomBytes(16).toString('hex');
    //FIXME: delete the old picture here if it exists!

    const ext = path.extname(file.originalname);
    file = {
      ...file,
      originalname: `photo_${insToRet.id}_${randomString}${ext}`,
    };
    const resLink = await this.storageService.uploadFile(
      file,
      StorageContainer.inscovers,
    );
    await this.insService.update({
      where: { id: userID },
      data: {
        cover: resLink
      },
    });

    return { success: true }
  }
}
