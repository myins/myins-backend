import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { INS, Post, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { retry } from 'ts-retry-promise';
import * as path from 'path';
import { StorageContainer, StorageService } from 'src/storage/storage.service';
import * as uuid from 'uuid';
import { omit } from 'src/util/omit';
import { UserConnectionService } from 'src/user/user.connection.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import {
  InsWithCountMembers,
  InsWithCountMembersInclude,
} from 'src/prisma-queries-helper/ins-include-count-members';
import { UserService } from 'src/user/user.service';
import fetch from 'node-fetch';
import { PostService } from 'src/post/post.service';

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
        this.prismaService.iNS.create({
          data,
        }),
      { retries: 3 },
    );
  }

  async insList(userID: string, filter: string) {
    // First we get all the user's ins connections, ordered by his interaction count
    const whereQuery: Prisma.UserInsConnectionWhereInput = {
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
    };

    const userIDs = [
      'a714825b-bc0b-4f83-aa36-d23aaf6015cd',
      '13370fc6-51c1-4847-b3b5-f4be2598d344',
    ];

    if (!userIDs.includes(userID)) {
      whereQuery.role = {
        not: UserRole.PENDING,
      };
    }

    const connectionQuery = await this.userConnectionService.getConnections({
      where: whereQuery,
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
      include: InsWithCountMembersInclude,
    });

    // And finally sort the received inses by their position in the onlyIDs array
    const orderedByIDs = connectionQuery
      .map((each) => {
        let theRightINS = toRet.find((each2) => each2.id == each.insId);
        if (theRightINS?.invitedPhoneNumbers) {
          theRightINS = <InsWithCountMembers>(
            omit(theRightINS, 'invitedPhoneNumbers')
          );
        }
        return {
          ...theRightINS,
          userRole: each.role,
          pinned: each.pinned,
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
  ): Promise<Post[]> {
    return this.postService.posts({
      skip: skip,
      take: take,
      include: this.postService.richPostInclude(userID, true),
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
      },
    });
  }

  async membersForIns(
    insID: string,
    skip?: number,
    take?: number,
    filter?: string,
  ) {
    return this.userService.users({
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
    insIDs: string[],
    userID: string,
    phoneNumber: string,
  ) {
    const data = insIDs.map((insID) => ({
      insId: insID,
      userId: userID,
    }));
    await this.userConnectionService.createMany(data);

    this.logger.log(
      `Remove phone number ${phoneNumber} as invited phone number from inses ${insIDs}`,
    );
    return Promise.all(
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

  async ins(
    where: Prisma.INSWhereUniqueInput,
    include?: Prisma.INSInclude,
  ): Promise<INS | null> {
    let ins = await this.prismaService.iNS.findUnique({
      where: where,
      include: include,
    });
    if (ins?.invitedPhoneNumbers) {
      ins = <INS>omit(ins, 'invitedPhoneNumbers');
    }
    return ins;
  }

  async inses(params: Prisma.INSFindManyArgs): Promise<INS[]> {
    const inses = await this.prismaService.iNS.findMany(params);
    const insesWithoutPhoneNumbers = inses.map((ins) => {
      if (ins.invitedPhoneNumbers) {
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
