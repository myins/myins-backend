import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShallowUserSelect } from 'src/util/shallow-user';

@Injectable()
export class PostFeedService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  richPostInclude(userID: string): Prisma.PostInclude {
    return {
      _count: {
        select: {
          likes: true,
          comments: true
        },
      },
      likes: {
        where: {
          id: userID,
        },
        select: {
          id: true,
        },
      },
      mediaContent: true,
      inses: {
        select: {
          name: true,
          cover: true
        }
      },
      author: {
        select: ShallowUserSelect,
      },
    }
  }

  async getFeed(skip: number, take: number, userID: string) {
    return this.prisma.post.findMany({
      skip: skip,
      take: take,
      include: this.richPostInclude(userID),
      orderBy: {
        createdAt: 'desc'
      },
      where: {
        inses: {
          some: {
            members: {
              some: {
                id: userID
              }
            }
          }
        }
      }
    })
  }
  async getStoriesFeed(userID: string) {
    const allINS = await this.prisma.iNS.findMany({
      where: {
        members: {
          some: {
            id: userID
          }
        }
      },
      select: {
        id: true
      }
    })

    const richInclude = this.richPostInclude(userID)
    const toRet = await Promise.all(allINS.map(each => {
      return this.prisma.post.findFirst({
        where: {
          inses: {
            some: {
              id: each.id
            }
          }
        },
        include: richInclude,
        orderBy: {
          createdAt: 'desc'
        }
      })
    }))
    return toRet.filter(each => each != null)
  }
}
