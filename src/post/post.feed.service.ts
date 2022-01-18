import { Injectable } from '@nestjs/common';
import { Post, UserRole } from '@prisma/client';
import { PostService } from './post.service';

@Injectable()
export class PostFeedService {
  constructor(private readonly postService: PostService) {}

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
