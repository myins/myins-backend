import { Injectable, Logger } from '@nestjs/common';
import { Post } from '@prisma/client';
import { UserConnectionService } from 'src/user/user.connection.service';
import { PostService } from './post.service';

@Injectable()
export class PostFeedService {
  private readonly logger = new Logger(PostFeedService.name);

  constructor(
    private readonly postService: PostService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async getFeed(skip: number, take: number, userID: string): Promise<Post[]> {
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
            members: {
              some: {
                userId: userID,
              },
            },
          },
        },
        pending: false,
      },
    });
  }

  async getStoriesFeed(userID: string) {
    this.logger.log(`Getting all ins connections for user ${userID}`);
    const allINS = await this.userConnectionService.getConnections({
      where: {
        userId: userID,
      },
      orderBy: {
        interactions: 'desc',
      },
    });

    this.logger.log(
      `Getting first post for every ins from ins connections for user ${userID}`,
    );
    const richInclude = this.postService.richPostInclude(userID);
    const toRet = await Promise.all(
      allINS.map((each) => {
        return this.postService.firstPost({
          where: {
            inses: {
              some: {
                id: each.insId,
              },
            },
            pending: false,
          },
          include: richInclude,
          orderBy: {
            createdAt: 'desc',
          },
        });
      }),
    );
    return toRet.filter((each) => each != null);
  }
}
