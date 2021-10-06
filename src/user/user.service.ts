import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, UserRole } from '@prisma/client';
import { omit } from 'src/util/omit';
import { SjwtService } from 'src/sjwt/sjwt.service';
import { SmsService } from 'src/sms/sms.service';
import { ChatService } from 'src/chat/chat.service';
import { InsService } from 'src/ins/ins.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: SjwtService,
    private smsService: SmsService,
    @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
    private insService: InsService,
  ) {}

  async user(
    where: Prisma.UserWhereUniqueInput,
    include?: Prisma.UserInclude,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: where,
      include: include,
    });
  }

  async firstUser(where: Prisma.UserWhereInput): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: where,
    });
  }

  async getUserProfile(userID: string, asUserID?: string) {
    const userModel = await this.user(
      { id: userID },
      {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    );
    if (userModel == null) {
      throw new NotFoundException();
    }
    let toRet = { ...omit(userModel, 'password', 'refreshToken', 'pushToken') };
    if (userID === asUserID) {
      toRet = {
        ...toRet,
        ...{
          cloudfrontToken: this.getCloudfrontToken('', asUserID),
        },
      };
    }
    if (!asUserID || userID === asUserID) {
      toRet = {
        ...toRet,
        ...{
          streamChatToken: this.chatService.createStreamChatToken(userID),
        },
      };
    }
    return toRet;
  }

  async users(params: Prisma.UserFindManyArgs): Promise<User[]> {
    return this.prisma.user.findMany(params);
  }

  //FIXME: also figure out type returns to allow select
  async shallowUsers(params: Prisma.UserFindManyArgs) {
    params.select = ShallowUserSelect;
    return this.users(params);
  }

  async createUser(data: Prisma.UserCreateInput) {
    const newUserModel = await this.prisma.user.create({
      data,
    });

    const authTokens = await this.jwtService.generateNewAuthTokens(
      newUserModel.phoneNumber,
      newUserModel.id,
    );

    // Get the new user profile, this includes following counts, etc.
    const newUserProfile = await this.getUserProfile(newUserModel.id);
    const addedTogether = {
      ...newUserProfile,
      ...authTokens,
    };

    this.smsService.sendVerificationCode(newUserModel);

    const inses = await this.insService.inses({
      where: {
        invitedPhoneNumbers: {
          has: newUserProfile.phoneNumber,
        },
      },
    });
    await this.insService.addInvitedExternalUserIntoINSes(
      inses.map((ins) => ins.id),
      newUserProfile.id,
      newUserProfile.phoneNumber,
    );

    return addedTogether;
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async deleteUser(userId: string): Promise<User> {
    return this.prisma.user.delete({
      where: {
        id: userId,
      },
    });
  }

  async logoutUser(userID: string) {
    return this.updateUser({
      where: {
        id: userID,
      },
      data: {
        refreshToken: null,
        pushToken: null,
      },
    });
  }

  async approveUser(userId: string, insId: string) {
    return this.prisma.userInsConnection.update({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
      data: {
        role: UserRole.MEMBER,
      },
    });
  }

  async denyUser(id: string, userId: string, insId: string) {
    return this.prisma.userInsConnection.update({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
      data: {
        deniedByUsers: {
          push: id,
        },
      },
    });
  }

  async setLastReadNotificationID(userID: string, notifID: string) {
    return this.updateUser({
      where: {
        id: userID,
      },
      data: {
        lastReadNotificationID: notifID,
      },
    });
  }

  getCloudfrontToken(phone: string, userID: string) {
    return this.jwtService.getCloudfrontToken({ phone, sub: userID });
  }
}
