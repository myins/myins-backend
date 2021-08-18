import { BadRequestException, Body, Controller, NotFoundException, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserID } from 'src/decorators/user-id.decorator';
import { photoInterceptor } from 'src/util/multer';
import { CreateINSAPI } from './ins-api.entity';
import { InsService } from './ins.service';
import * as crypto from 'crypto';
import * as path from 'path';
import { StorageContainer, StorageService } from 'src/storage/storage.service';

@Controller('ins')
export class InsController {
    constructor(private readonly insService: InsService, private readonly storageService: StorageService) {}

    @Post()
    @ApiTags('ins')
    @UseGuards(JwtAuthGuard)
    async createINS(@UserID() userID: string, @Body() data: CreateINSAPI) {
        return this.insService.createINS(userID, data)
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/updateCover')
    @ApiTags('ins')
    @UseInterceptors(photoInterceptor)
    async updateCover(
      @UserID() userID: string,
      @Param('id') insID: string,
      @UploadedFile()
      file: Express.Multer.File,
    ) {
      if (!file) {
        throw new BadRequestException('Could not find picture file!');
      }
      const insToRet = await this.insService.ins({id: insID})
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
