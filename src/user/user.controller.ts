import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as path from 'path';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { SmsService } from 'src/sms/sms.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { UserService } from 'src/user/user.service';
import { photoInterceptor } from 'src/util/multer';
import {
  CreateUserAPI,
  SetLastNotificationAPI,
  UpdatePushTokenAPI,
  UpdateUserAPI,
} from './user-api.entity';

@Controller('user')
@UseInterceptors(NotFoundInterceptor)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly smsService: SmsService,
  ) {}

  @Get('cloudfront-token')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users')
  async getUserJWT(@PrismaUser() user: User) {
    const newToken = await this.userService.getCloudfrontToken(
      user.phoneNumber,
      user.id,
    );
    return {
      cloudfrontToken: newToken,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users')
  async getUser(@Param('id') id: string, @PrismaUser('id') asUserID: string) {
    return this.userService.getUserProfile(id, asUserID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('updatePicture')
  @ApiTags('users')
  @UseInterceptors(photoInterceptor)
  async updateUserProfilePic(
    @PrismaUser() user: User,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Could not find picture file!');
    }
    const randomString = crypto.randomBytes(16).toString('hex');
    //FIXME: delete the old picture here if it exists!

    const ext = path.extname(file.originalname);
    file = {
      ...file,
      originalname: `photo_${user.id}_${randomString}${ext}`,
    };
    const resLink = await this.storageService.uploadFile(
      file,
      StorageContainer.profilepictures,
    );
    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        profilePicture: resLink,
      },
    });

    return this.getUser(user.id, user.id);
  }

  @Patch()
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async updateUserProfile(
    @Body() data: UpdateUserAPI,
    @PrismaUser() user: User,
  ) {
    try {
      const existingPhoneNumber = user.phoneNumber;
      if (existingPhoneNumber == undefined) {
        throw new BadRequestException('Could not find your user!');
      }
      const didChangePhone = data.phone != existingPhoneNumber;
      const toRet = await this.userService.updateUser({
        where: {
          id: user.id,
        },
        data: {
          phoneNumberVerified: didChangePhone ? false : undefined,
          ...data,
        },
      });
      if (didChangePhone) {
        this.smsService.sendVerificationCode(toRet);
      }
      return this.getUser(user.id, user.id);
    } catch (err) {
      throw new BadRequestException('That username / phone is already taken!');
    }
  }

  @Post()
  @ApiTags('users')
  async signupUser(@Body() userData: CreateUserAPI) {
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
    } catch (error) {
      throw new BadRequestException(
        'Could not create user, maybe it already exists?',
      );
    }
  }

  @Post('updateToken')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async updateToken(
    @Body() dataModel: UpdatePushTokenAPI,
    @PrismaUser('id') userID: string,
  ) {
    return this.userService.updateUser({
      where: {
        id: userID,
      },
      data: {
        pushToken: dataModel.pushToken,
        sandboxToken: dataModel.isSandbox,
      },
    });
  }

  @Patch('setLastNotification')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async setLastNotification(
    @Body() data: SetLastNotificationAPI,
    @PrismaUser('id') userID: string,
  ) {
    return this.userService.setLastReadNotificationID(userID, data.notifID);
  }

  @Delete(':id')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') userId: string) {
    const user = await this.userService.user({
      id: userId,
    });
    if (!user) {
      throw new NotFoundException('Could not find this user!');
    }
    return this.userService.deleteUser({ id: userId });
  }
}
