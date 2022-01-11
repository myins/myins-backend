import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { INS, Post, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { retry } from 'ts-retry-promise';
import * as path from 'path';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { omit } from 'src/util/omit';
import { UserConnectionService } from 'src/user/user.connection.service';
import { ShallowUserSelectWithRoleInclude } from 'src/prisma-queries-helper/shallow-user-select';
import { UserService } from 'src/user/user.service';
import fetch from 'node-fetch';
import { PostService } from 'src/post/post.service';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';

@Injectable()
export class InsService {
  private readonly logger = new Logger(InsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly userConnectionService: UserConnectionService,
    private readonly postService: PostService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async createINS(data: Prisma.INSCreateInput): Promise<INS> {
    // Retry it a couple of times in case the code is taken
    return retry(
      async () =>
        await this.prismaService.iNS.create({
          data,
        }),
      { retries: 3 },
    );
  }

  async insList(userID: string, filter: string, withoutPending: boolean) {
    // First we get all the user's ins connections, ordered by his interaction count
    const connectionQuery = await this.userConnectionService.getConnections({
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
        role: withoutPending
          ? {
              not: UserRole.PENDING,
            }
          : undefined,
      },
      orderBy: [{ pinned: 'desc' }, { interactions: 'desc' }],
    });
    const onlyIDs = connectionQuery.map((each) => each.insId);

    // Now get all the inses, using the in query
    this.logger.log(`Getting all inses where user ${userID} is a member`);
    const toRet = await this.inses({
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

    // The following hack is due to https://github.com/prisma/prisma/issues/8413
    // We can't filter relation counts, so instead we get all the PENDING members (should be a small amount)
    // And we put them in a map where the key is the INS ID, and the value is the number of pending members
    const pendingCountPerINS: { [key: string]: number } = {};
    (
      await this.userConnectionService.getConnections({
        where: {
          insId: {
            in: onlyIDs,
          },
          OR: [
            {
              role: UserRole.PENDING,
            },
            {
              user: {
                isDeleted: true,
              },
            },
          ],
        },
      })
    ).forEach((cur) => {
      pendingCountPerINS[cur.insId] = (pendingCountPerINS[cur.insId] ?? 0) + 1;
    });

    // Now we substract the pending count from the full count
    toRet.forEach((each) => {
      const castedIns = <
        INS & {
          _count: {
            members: number;
          };
        }
      >each;
      const theCount = castedIns._count;
      if (pendingCountPerINS[each.id] && theCount) {
        theCount.members -= pendingCountPerINS[each.id];
        castedIns._count = theCount;
      }
    });

    // And finally sort the received inses by their position in the onlyIDs array
    const orderedByIDs = connectionQuery
      .map((each) => {
        const theRightINS = toRet.find((each2) => each2.id == each.insId);
        return {
          ...theRightINS,
          userRole: each.role,
          pinned: each.pinned,
          isMute: !!each.muteUntil,
        };
      })
      .filter((each) => {
        return each !== undefined;
      });

    this.logger.log(
      `Ins list successfully returned for user ${userID} with filter '${filter}'`,
    );
    return orderedByIDs;
  }

  async mediaForIns(
    userID: string,
    insID: string,
    skip: number,
    take: number,
    onlyMine: boolean,
  ): Promise<Post[]> {
    return this.postService.posts({
      skip: skip,
      take: take,
      include: this.postService.richPostInclude(userID),
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        inses: {
          some: {
            id: insID,
          },
        },
        pending: false,
        authorId: onlyMine ? userID : undefined,
      },
    });
  }

  async membersForIns(
    insID: string,
    userID?: string,
    skip?: number,
    take?: number,
    filter?: string,
    without?: boolean,
  ) {
    const whereQuery: Prisma.UserWhereInput = {
      id: without
        ? {
            not: userID,
          }
        : undefined,
      inses: {
        some: {
          insId: insID,
          role: {
            not: UserRole.PENDING,
          },
          user: {
            isDeleted: false,
          },
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
    };

    const users = await this.userService.users({
      where: whereQuery,
      skip: skip,
      take: take,
      orderBy: {
        firstName: 'desc',
      },
      select: ShallowUserSelectWithRoleInclude(insID),
    });

    const castedUsers = <
      (User & {
        inses: (INS & {
          role: UserRole;
        })[];
      })[]
    >users;
    const usersWithRole = castedUsers.map((user) => {
      const role = user.inses[0].role;
      const newUser = omit(user, 'inses');
      return {
        ...newUser,
        userRole: role,
      };
    });

    return usersWithRole;
  }

  async addAsInvitedPhoneNumbers(
    insId: string,
    phoneNumbers: string[],
  ): Promise<INS> {
    return this.update({
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
    inses: INS[],
    userID: string,
    phoneNumber: string,
  ) {
    const data: Prisma.UserInsConnectionCreateManyInput[] = inses
      .map((ins) => ins.id)
      .map((insID) => ({
        insId: insID,
        userId: userID,
      }));
    await this.userConnectionService.createMany(data);
    this.logger.log(
      `Remove phone number ${phoneNumber} as invited phone number from inses ${inses.map(
        (ins) => ins.id,
      )}`,
    );

    return Promise.all(
      inses.map(async (ins) => {
        await this.update({
          where: {
            id: ins.id,
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

  async ins(
    where: Prisma.INSWhereUniqueInput,
    include?: Prisma.INSInclude,
    withInvitedPhoneNumbers?: boolean,
  ): Promise<INS | null> {
    let ins = await this.prismaService.iNS.findUnique({
      where: where,
      include: include,
    });
    if (ins?.invitedPhoneNumbers && !withInvitedPhoneNumbers) {
      ins = <INS>omit(ins, 'invitedPhoneNumbers');
    }
    return ins;
  }

  async inses(
    params: Prisma.INSFindManyArgs,
    withInvitedPhoneNumbers?: boolean,
  ): Promise<INS[]> {
    const inses = await this.prismaService.iNS.findMany(params);
    const insesWithoutPhoneNumbers = inses.map((ins) => {
      if (ins.invitedPhoneNumbers && !withInvitedPhoneNumbers) {
        return <INS>omit(ins, 'invitedPhoneNumbers');
      }
      return ins;
    });
    return insesWithoutPhoneNumbers;
  }

  //FIXME: figure out type safety with select statements
  async insesSelectIDs(where: Prisma.INSWhereInput): Promise<INS[]> {
    return this.inses({
      where: where,
      select: {
        id: true,
      },
    });
  }

  async update(params: Prisma.INSUpdateArgs): Promise<INS> {
    return this.prismaService.iNS.update(params);
  }

  async attachCoverToPost(
    file: Express.Multer.File,
    insID: string,
  ): Promise<INS> {
    const ext = path.extname(file.originalname);
    const randomUUID = uuid.v4();
    const postName = `cover_${insID}_${randomUUID}${ext}`;
    let x = file;
    x = {
      ...x,
      originalname: postName,
    };

    this.logger.log(`Uploading file to S3 with original name '${postName}'`);
    const dataURL = await this.storageService.uploadFile(
      x,
      StorageContainer.posts,
    );

    this.logger.log(`Updating ins ${insID}. Changing cover '${dataURL}'`);
    return this.update({
      where: {
        id: insID,
      },
      data: {
        cover: dataURL,
      },
      select: ShallowINSSelect,
    });
  }

  async deleteMany(params: Prisma.INSDeleteManyArgs) {
    return this.prismaService.iNS.deleteMany(params);
  }

  async randomCode() {
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

  async insesWithAdmin() {
    return this.prismaService.iNS.findMany({
      include: {
        members: {
          where: {
            role: UserRole.ADMIN,
          },
        },
      },
    });
  }
}
