import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { ShallowINSSelect } from 'src/prisma-queries-helper/shallow-ins-select';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  async post(
    postWhereUniqueInput: Prisma.PostWhereUniqueInput,
    include?: Prisma.PostInclude,
  ): Promise<Post | null> {
    return this.prisma.post.findUnique({
      where: postWhereUniqueInput,
      include,
    });
  }

  async postWithUserInfo(
    postWhereUniqueInput: Prisma.PostWhereUniqueInput,
  ): Promise<Post | null> {
    return this.post(postWhereUniqueInput, {
      author: {
        select: ShallowUserSelect,
      },
    });
  }

  richPostInclude(userID: string, desc?: boolean): Prisma.PostInclude {
    return {
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
      likes: {
        where: {
          userId: userID,
        },
        select: {
          userId: true,
        },
      },
      mediaContent: {
        orderBy: {
          createdAt: desc ? 'desc' : 'asc',
        },
      },
      ins: {
        select: ShallowINSSelect,
      },
      author: {
        select: ShallowUserSelect,
      },
    };
  }

  async injectedPost(postID: string, asUserID: string): Promise<Post | null> {
    return this.post(
      {
        id: postID,
      },
      this.richPostInclude(asUserID),
    );
  }

  async posts(params: Prisma.PostFindManyArgs): Promise<Post[]> {
    return this.prisma.post.findMany(params);
  }

  async count(params: Prisma.PostCountArgs): Promise<number> {
    return this.prisma.post.count(params);
  }

  async createPost(data: Prisma.PostCreateInput): Promise<Post> {
    return this.prisma.post.create({
      data,
    });
  }

  async updatePost(params: Prisma.PostUpdateArgs): Promise<Post> {
    return this.prisma.post.update(params);
  }

  async updateManyPosts(params: Prisma.PostUpdateManyArgs) {
    return this.prisma.post.updateMany(params);
  }

  async deletePost(
    where: Prisma.PostWhereUniqueInput,
    include?: Prisma.PostInclude,
  ): Promise<Post> {
    return this.prisma.post.delete({
      where,
      include,
    });
  }

  async deleteManyPosts(params: Prisma.PostDeleteManyArgs) {
    return this.prisma.post.deleteMany(params);
  }
}
