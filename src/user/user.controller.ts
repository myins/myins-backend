import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationSource, Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as path from 'path';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaUser } from 'src/decorators/user.decorator';
import { InsService } from 'src/ins/ins.service';
import { NotFoundInterceptor } from 'src/interceptors/notfound.interceptor';
import { NotificationService } from 'src/notification/notification.service';
import { SmsService } from 'src/sms/sms.service';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import { UserService } from 'src/user/user.service';
import { photoInterceptor } from 'src/util/multer';
import {
  CreateUserAPI,
  UpdatePushTokenAPI,
  UpdateUserAPI,
} from './user-api.entity';
import { UserConnectionService } from './user.connection.service';
import * as uuid from 'uuid';
import { ChatService } from 'src/chat/chat.service';

@Controller('user')
@UseInterceptors(NotFoundInterceptor)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userConnectionService: UserConnectionService,
    private readonly storageService: StorageService,
    private readonly smsService: SmsService,
    private readonly insService: InsService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  @Get('cloudfront-token')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users')
  async getUserJWT(@PrismaUser() user: User) {
    this.logger.log(
      `Getting cloud front token for user ${user.id} with phone number ${user.phoneNumber}`,
    );
    const newToken = this.userService.getCloudfrontToken(
      user.phoneNumber,
      user.id,
    );

    this.logger.log('Cloud front token successfully generated');
    return {
      cloudfrontToken: newToken,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiTags('users')
  async getUser(@Param('id') id: string, @PrismaUser('id') asUserID: string) {
    this.logger.log(`Getting profile for user ${id} by user ${asUserID}`);
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
      this.logger.error('Could not find picture file!');
      throw new NotFoundException('Could not find picture file!');
    }

    this.logger.log(`Updating profile picture for user ${user.id}`);
    const randomString = crypto.randomBytes(16).toString('hex');
    //FIXME: delete the old picture here if it exists!

    const ext = path.extname(file.originalname);
    const name = `photo_${user.id}_${randomString}${ext}`;
    file = {
      ...file,
      originalname: name,
    };

    this.logger.log(`Uploading file to S3 with original name '${name}'`);
    const resLink = await this.storageService.uploadFile(
      file,
      StorageContainer.profilepictures,
    );

    this.logger.log(
      `Updating user ${user.id}. Changing profile picture to '${resLink}'`,
    );
    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        profilePicture: resLink,
      },
    });

    this.logger.log(
      `Profile picture successfully changed. Return user ${user.id}`,
    );
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
        this.logger.error(
          `Could not find user with phone ${user.phoneNumber}!`,
        );
        throw new NotFoundException('Could not find your user!');
      }

      this.logger.log(`Updating user ${user.id}`);
      const newPhoneNumber = data.phoneNumber;
      const didChangePhone =
        data.phoneNumber && data.phoneNumber != existingPhoneNumber;
      data.phoneNumber = existingPhoneNumber;
      const toRet = await this.userService.updateUser({
        where: {
          id: user.id,
        },
        data,
      });
      if (didChangePhone) {
        this.logger.log('Phone number changed. Sending verification code');
        this.smsService.sendVerificationCode(toRet, newPhoneNumber);
      }

      this.logger.log(`Updated successfully. Return user ${user.id}`);
      return this.getUser(user.id, user.id);
    } catch (err) {
      this.logger.error('Error updating user!');
      this.logger.error(err);
      throw new BadRequestException('That username / phone is already taken!');
    }
  }

  @Post()
  @ApiTags('users')
  async signupUser(@Body() userData: CreateUserAPI & UpdatePushTokenAPI) {
    this.logger.log(
      `Signing up user with phone number ${userData.phoneNumber}`,
    );
    const saltOrRounds = 10;

    this.logger.log('Encrypting password');
    const hashedPassword = await bcrypt.hash(userData.password, saltOrRounds);

    const toCreate: Prisma.UserCreateInput = {
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
      pushToken: userData.pushToken,
      sandboxToken: userData.isSandbox,
    };
    try {
      const inses = await this.insService.inses(
        {
          where: {
            invitedPhoneNumbers: {
              has: toCreate.phoneNumber,
            },
          },
        },
        true,
      );

      this.logger.log(
        `Creating user with phone number ${toCreate.phoneNumber}`,
      );
      const createdUser = await this.userService.createUser(toCreate, inses); // This calls sendVerificationCode

      await Promise.all(
        inses.map(async (ins) => {
          this.logger.log(
            `Creating notification for joining ins ${ins.id} by user ${createdUser.id}`,
          );

          const targetIDs = (
            await this.userConnectionService.getConnections({
              where: {
                insId: ins.id,
                role: {
                  not: UserRole.PENDING,
                },
              },
            })
          ).map((connection) => {
            return { id: connection.userId };
          });

          await this.notificationService.createNotification({
            source: NotificationSource.JOINED_INS,
            targets: {
              connect: targetIDs,
            },
            author: {
              connect: {
                id: createdUser.id,
              },
            },
            ins: {
              connect: {
                id: ins.id,
              },
            },
          });
        }),
      );

      return createdUser;
    } catch (error) {
      this.logger.error('Error creating user!');
      this.logger.error(error);
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
    @PrismaUser() user: User,
  ) {
    this.logger.log(
      `Updating user ${user.id}. Change pushToken and sandboxToken`,
    );
    await this.userService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        pushToken: dataModel.pushToken ?? null,
        sandboxToken: dataModel.isSandbox,
      },
    });

    this.logger.log(`Updating device token for user stream ${user.id}`);
    await this.chatService.updateDeviceToken(
      user.id,
      user.pushToken,
      dataModel.pushToken,
    );

    this.logger.log('Updated token successfully');
    return {
      message: 'Updated token successfully!',
    };
  }

  @Get('inses/admin')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async getInsesAdmin(@PrismaUser('id') userId: string) {
    this.logger.log(`Getting inses where user ${userId} is admin`);
    const inses = await this.insService.inses({
      where: {
        members: {
          some: {
            userId: userId,
            role: UserRole.ADMIN,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const hasIns = true;
    if (inses.length) {
      this.logger.log(`User ${userId} is an admin for some inses`);
      return {
        inses: inses,
        hasIns: hasIns,
      };
    } else {
      this.logger.log(`Getting inses for user ${userId}`);
      const userInses = await this.insService.inses({
        where: {
          members: {
            some: {
              userId: userId,
              role: {
                not: UserRole.PENDING,
              },
            },
          },
        },
      });

      if (userInses.length === 1) {
        this.logger.log(
          `User ${userId} is member only for an ins. Return ins name`,
        );
        return {
          inses: [],
          nameIns: userInses[0].name,
          hasIns: hasIns,
        };
      }

      return {
        inses: [],
        hasIns: userInses.length > 0,
      };
    }
  }

  @Delete()
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@PrismaUser('id') userId: string) {
    const user = await this.userService.user({
      id: userId,
    });
    if (!user) {
      this.logger.error(`Could not find user ${userId}!`);
      throw new NotFoundException('Could not find this user!');
    }

    this.logger.log(`Deleting user ${userId}`);
    await this.userService.deleteUser({ id: userId });

    this.logger.log('User successfully deleted');
    return {
      message: 'User successfully deleted',
    };
  }

  @Put('make-myins-user')
  @ApiTags('users')
  @UseGuards(JwtAuthGuard)
  async makeMyInsUser(@PrismaUser() user: User) {
    this.logger.log(`Updating user ${user.id}. Make user a MyINS user`);
    const hashedPhoneNumber = `-${user.phoneNumber}-${uuid.v4()}`;
    await this.userService.updateUser({
      where: {
        id: user.id,
      },
      data: {
        phoneNumber: hashedPhoneNumber,
        phoneNumberVerified: false,
        firstName: 'MyINS',
        lastName: 'User',
        profilePicture: null,
        refreshToken: null,
        pushToken: null,
        sandboxToken: null,
        lastAcceptedTermsAndConditionsVersion: null,
        lastAcceptedPrivacyPolicyVersion: null,
        lastReadNotification: new Date(),
        disabledNotifications: [],
        disabledBiometryINSIds: [],
        disabledAllBiometry: false,
        isDeleted: true,
      },
    });

    this.logger.log(
      `Removing all pending members that are invited by user ${user.id}`,
    );
    await this.userConnectionService.removeManyMembers({
      invitedBy: user.id,
      role: UserRole.PENDING,
    });

    this.logger.log(`Removing user stream ${user.id}`);
    await this.chatService.deleteStreamUser(user.id);

    this.logger.log('Successfully updated user as a MyINS user');
    return {
      message: 'Successfully updated user as a MyINS user!',
    };
  }
}
