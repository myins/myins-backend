import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from 'src/user/user.service';
import { Prisma } from '@prisma/client';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as bcrypt from 'bcryptjs';
import { UserID } from 'src/decorators/user-id.decorator';
import { CreateUserAPI, DeleteUserAPI, UpdatePushTokenAPI, UpdateUserAPI } from './user-api.entity';
import * as crypto from 'crypto';
import * as path from 'path';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { photoInterceptor } from 'src/util/multer';
import { SmsService } from 'src/sms/sms.service';

@Controller('user')
@UseInterceptors(NotFoundInterceptor)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly smsService: SmsService
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users')
  async getUser(@Param('id') id: string) {
    return this.userService.getUserProfile(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('updatePicture')
  @ApiTags('users')
  @UseInterceptors(photoInterceptor)
  async updateUserProfilePic(
    @UserID() userID: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Could not find picture file!');
    }
    const userToRet = await this.userService.user({ id: userID });
    if (!userToRet) {
      throw new NotFoundException('Could not find user :(');
    }
    const randomString = crypto.randomBytes(16).toString('hex');
    //FIXME: delete the old picture here if it exists!

    const ext = path.extname(file.originalname);
    file = {
      ...file,
      originalname: `photo_${userToRet.id}_${randomString}${ext}`,
    };
    const resLink = await this.storageService.uploadFile(
      file,
      StorageContainer.profilepictures,
    );
    const user = await this.userService.updateUser({
      where: { id: userID },
      data: {
        profilePicture: resLink,
      },
    });

    return this.getUser(userID)
  }

  @Patch()
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async updateUserProfile(
    @Body() data: UpdateUserAPI,
    @UserID() userID: string,
  ) {
    try {
      const existingPhoneNumber = (await this.userService.user({ id: userID }))?.phoneNumber;
      if (existingPhoneNumber == undefined) {
        throw new BadRequestException("Could not find your user!")
      }
      const didChangePhone = data.phone != existingPhoneNumber
      const toRet = await this.userService.updateUser({
        where: {
          id: userID,
        },
        data: {
          phoneNumberVerified: didChangePhone ? false : undefined,
          ...data,
        },
      });
      if (didChangePhone) {
        this.smsService.sendVerificationCode(toRet)
      }
      return this.getUser(userID)
    } catch (err) {
      throw new BadRequestException('That username / phone is already taken!');
    }
  }

  @Post()
  @ApiTags('users')
  async signupUser(
    @Body() userData: CreateUserAPI,
  ) {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltOrRounds);

    const toCreate: Prisma.UserCreateInput = {
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
    };
    try {
    return this.userService.createUser(toCreate); // This calls sendVerificationCode
    } catch(error) {
      throw new BadRequestException("Could not create user, maybe it already exists?")
    }
  }

  @Post('deleteUser')
  @ApiTags('users-testing')
  async deleteUser(@Body() dataModel: DeleteUserAPI) {
    try {
      const toRet = await this.userService.deleteUser({
        id: dataModel.userID,
      });
      return toRet;
    } catch (exception) {
      throw new BadRequestException('User does not exist!');
    }
  }


  @Post('updateToken')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async updateToken(@Body() dataModel: UpdatePushTokenAPI, @UserID() userID: string) {
    await this.userService.updateUser({
      where: {
        id: userID
      },
      data: {
        pushToken: dataModel.pushToken,
        sandboxToken: dataModel.isSandbox
      }
    })
    return {
      message: "Updated token successfully!"
    }
  }
}
