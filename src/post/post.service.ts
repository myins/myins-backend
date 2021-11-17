import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
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

  async firstPost(params: Prisma.PostFindFirstArgs): Promise<Post | null> {
    return this.prisma.post.findFirst(params);
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
      inses: true,
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

  async postsWithRelatedInfo(params: Prisma.PostFindManyArgs): Promise<Post[]> {
    params.include = {
      author: {
        select: ShallowUserSelect,
      },
      mediaContent: true,
    };
    return this.posts(params);
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

  async deletePost(where: Prisma.PostWhereUniqueInput): Promise<Post> {
    return this.prisma.post.delete({
      where,
    });
  }

  async deleteManyPosts(data: Prisma.PostDeleteManyArgs) {
    return this.prisma.post.deleteMany(data);
  }
}
