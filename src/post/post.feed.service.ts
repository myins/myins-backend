import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ShallowUserSelect } from 'src/util/shallow-user';
import { PostService } from './post.service';

@Injectable()
export class PostFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaService: PrismaService,
    private readonly postService: PostService
  ) {}

  async getFeed(skip: number, take: number, userID: string) {
    return this.postService.postsInjectedFeed({
      skip: skip,
      take: take,
      asUserID: userID,
      orderBy: {
        createdAt: 'desc'
      },
      // where: {
      //   author: {
      //     privateProfile: false
      //   }
      // }
    })
  }
}
