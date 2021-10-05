import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { INS, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateINSAPI } from './ins-api.entity';
import { retry } from 'ts-retry-promise';
import * as path from 'path';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { ShallowUserSelect } from 'src/util/shallow-user';
import { omit } from 'src/util/omit';
import fetch from 'node-fetch';

@Injectable()
export class InsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createINS(userID: string | null, data: CreateINSAPI) {
    const user = userID
      ? await this.prismaService.user.findUnique({ where: { id: userID } })
      : null;
    if (!user && userID) {
      throw new UnauthorizedException("You're not allowed to do this!");
    }
    if (!user?.phoneNumberVerified && userID) {
      throw new UnauthorizedException("You're not allowed to do this!");
    }

    // Retry it a couple of times in case the code is taken
    return retry(
      async () =>
        this.prismaService.iNS.create({
          data: {
            name: data.name,
            shareCode: await this.randomCode(),
            members: userID
              ? {
                  create: {
                    userId: userID,
                    role: UserRole.ADMIN,
                  },
                }
              : undefined,
          },
        }),
      { retries: 3 },
    );
  }

  async insList(userID: string, filter: string) {
    // First we get all the user's ins connections, ordered by his interaction count
    const connectionQuery = await this.prismaService.userInsConnection.findMany(
      {
        where: {
          userId: userID,
          ins:
            filter && filter.length > 0
              ? {
                  name: {
                    contains: filter,
                    mode: 'insensitive',
                  },
                }
              : undefined,
        },
        orderBy: {
          interactions: 'desc',
        },
      },
    );
    const onlyIDs = connectionQuery.map((each) => each.insId);

    // Now get all the inses, using the in query
    const toRet = await this.prismaService.iNS.findMany({
      where: {
        id: {
          in: onlyIDs,
        },
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    // And finally sort the received inses by their position in the onlyIDs array
    const orderedByIDs = connectionQuery
      .map((each) => {
        let theRightINS = toRet.find((each2) => each2.id == each.insId);
        if (theRightINS?.invitedPhoneNumbers) {
          theRightINS = <INS & { _count: { members: number } | null }>(
            omit(theRightINS, 'invitedPhoneNumbers')
          );
        }
        return {
          ...theRightINS,
          userRole: each.role,
        };
      })
      .filter((each) => {
        return each !== undefined;
      });

    return orderedByIDs;
  }

  async mediaForIns(insID: string, skip: number, take: number) {
    if (!insID || insID.length == 0) {
      throw new BadRequestException('Invalid ins ID!');
    }
    return this.prismaService.postContent.findMany({
      where: {
        post: {
          inses: {
            some: {
              id: insID,
            },
          },
        },
      },
      skip: skip,
      take: take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async membersForIns(
    insID: string,
    skip: number,
    take: number,
    filter: string,
  ) {
    //console.log(`Filter: ${filter}`)
    return this.prismaService.user.findMany({
      where: {
        inses: {
          some: {
            insId: insID,
          },
        },
        OR:
          filter && filter.length > 0
            ? [
                {
                  firstName: {
                    contains: filter,
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: filter,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
      },
      skip: skip,
      take: take,
      orderBy: {
        firstName: 'desc',
      },
      select: ShallowUserSelect,
    });
  }

  async addAsInvitedPhoneNumbers(insId: string, phoneNumbers: string[]) {
    return this.prismaService.iNS.update({
      where: {
        id: insId,
      },
      data: {
        invitedPhoneNumbers: {
          push: phoneNumbers,
        },
      },
    });
  }

  async addInvitedExternalUserIntoINSes(
    insIDs: string[],
    userID: string,
    phoneNumber: string,
  ) {
    const data = insIDs.map((insID) => ({
      insId: insID,
      userId: userID,
    }));
    await this.prismaService.userInsConnection.createMany({
      data: data,
    });
    await Promise.all(
      insIDs.map(async (insID) => {
        const ins = await this.ins({ id: insID });
        await this.update({
          where: {
            id: insID,
          },
          data: {
            invitedPhoneNumbers: ins?.invitedPhoneNumbers.filter(
              (invitedPhoneNumber) => invitedPhoneNumber !== phoneNumber,
            ),
          },
        });
      }),
    );
  }

  async ins(where: Prisma.INSWhereUniqueInput, include?: Prisma.INSInclude) {
    let ins = await this.prismaService.iNS.findUnique({
      where: where,
      include: include,
    });
    if (ins?.invitedPhoneNumbers) {
      ins = <INS>omit(ins, 'invitedPhoneNumbers');
    }
    return ins;
  }

  async inses(params: {
    skip?: number;
    take?: number;
    where?: Prisma.INSWhereInput;
    orderBy?: Prisma.INSOrderByWithRelationInput;
    include?: Prisma.INSInclude;
  }): Promise<INS[]> {
    const { skip, take, where, orderBy, include } = params;
    const inses = await this.prismaService.iNS.findMany({
      skip,
      take,
      where,
      orderBy,
      include: include,
    });
    const insesWithoutPhoneNumbers = inses.map((ins) => {
      if (ins.invitedPhoneNumbers) {
        return <INS>omit(ins, 'invitedPhoneNumbers');
      }
      return ins;
    });
    return insesWithoutPhoneNumbers;
  }

  //FIXME: figure out type safety with select statements
  async insesSelectIDs(where: Prisma.INSWhereInput) {
    const toRet = await this.prismaService.iNS.findMany({
      where: where,
      select: {
        id: true,
      },
    });
    return toRet;
  }

  async update(params: {
    where: Prisma.INSWhereUniqueInput;
    data: Prisma.INSUpdateInput;
  }): Promise<INS> {
    const { where, data } = params;
    return this.prismaService.iNS.update({
      data,
      where,
    });
  }

  async getConnection(userId: string, insId: string) {
    const connection = await this.prismaService.userInsConnection.findUnique({
      where: {
        userId_insId: {
          userId: userId,
          insId: insId,
        },
      },
    });
    return connection;
  }

  async attachCoverToPost(file: Express.Multer.File, insID: string) {
    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const postName = `cover_${insID}_${randomUUID}${ext}`;
    let x = file;
    x = {
      ...x,
      originalname: postName,
    };
    const dataURL = await this.storageService.uploadFile(
      x,
      StorageContainer.posts,
    );
    await this.prismaService.iNS.update({
      where: {
        id: insID,
      },
      data: {
        cover: dataURL,
      },
    });
  }

  private async randomCode() {
    const makeRandom = () => {
      const length = 20;
      let result = '';
      const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength),
        );
      }
      return result;
    };

    const res = await fetch(
      `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${process.env.FIREBASE_API_KEY}`,
      {
        body: JSON.stringify({
          dynamicLinkInfo: {
            domainUriPrefix: process.env.FIREBASE_DYNAMIC_URL_PREFIX,
            link: `${process.env.FIREBASE_REDIRECT_URL}/${makeRandom()}`,
            iosInfo: {
              iosBundleId: process.env.FIREBASE_IOS_BUNDLE_ID,
              iosAppStoreId: process.env.FIREBASE_APP_STORE_ID,
            },
          },
          suffix: {
            option: 'SHORT',
          },
        }),
        method: 'POST',
      },
    );
    const resData = await res.json();
    const shortLink = resData.shortLink;

    const parts = shortLink.split('/');
    const lastSegment = parts.pop() || parts.pop(); // handle potential trailing slash

    return lastSegment;
  }
}
