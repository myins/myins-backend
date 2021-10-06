import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

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

  async injectedPost(postID: string, asUserID: string) {
    const toRet = await this.prisma.post.findUnique({
      where: {
        id: postID,
      },
      include: {
        author: {
          select: ShallowUserSelect,
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: {
          where: {
            userId: asUserID,
          },
        },
        mediaContent: true,
      },
    });
    return toRet;
  }

  async posts(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PostWhereInput;
    orderBy?: Prisma.PostOrderByWithRelationInput;
    includeRelatedInfo: boolean;
  }): Promise<Post[]> {
    const { skip, take, where, orderBy, includeRelatedInfo } = params;
    return this.prisma.post.findMany({
      skip,
      take,
      where,
      orderBy,
      include: includeRelatedInfo
        ? {
            author: {
              select: ShallowUserSelect,
            },
            mediaContent: true,
          }
        : null,
    });
  }

  async createPost(data: Prisma.PostCreateInput): Promise<Post> {
    const toRet = await this.prisma.post.create({
      data,
    });
    return toRet;
  }

  async updatePost(params: {
    where: Prisma.PostWhereUniqueInput;
    data: Prisma.PostUpdateInput;
  }): Promise<Post> {
    const { data, where } = params;
    const toRet = await this.prisma.post.update({
      data,
      where,
    });
    return toRet;
  }

  async deletePost(postId: string): Promise<Post> {
    return this.prisma.post.delete({
      where: {
        id: postId,
      },
    });
  }
}
