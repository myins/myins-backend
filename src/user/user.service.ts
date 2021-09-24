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
import { ShallowUserSelect } from 'src/util/shallow-user';
import { ChatService } from 'src/chat/chat.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: SjwtService,
    private smsService: SmsService,
    @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
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

  async users(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  //FIXME: also figure out type returns to allow select
  async shallowUsers(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.Enumerable<Prisma.UserOrderByWithRelationInput>;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      select: ShallowUserSelect,
    });
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

  async logoutUser(userModel: User) {
    return this.updateUser({
      where: {
        id: userModel.id,
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

  getCloudfrontToken(phone: string, userID: string) {
    return this.jwtService.getCloudfrontToken({ phone, sub: userID });
  }
}
