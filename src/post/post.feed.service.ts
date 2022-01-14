import { Injectable, Logger } from '@nestjs/common';
import { Post, UserRole } from '@prisma/client';
import { UserConnectionService } from 'src/user/user.connection.service';
import { PostService } from './post.service';

@Injectable()
export class PostFeedService {
  private readonly logger = new Logger(PostFeedService.name);

  constructor(
    private readonly postService: PostService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  async getFeed(
    skip: number,
    take: number,
    userID: string,
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
        inses: !onlyMine
          ? {
              some: {
                ins: {
                  members: {
                    some: {
                      userId: userID,
                      role: {
                        not: UserRole.PENDING,
                      },
                    },
                  },
                },
              },
            }
          : undefined,
        pending: false,
        authorId: onlyMine ? userID : undefined,
      },
    });
  }
}
