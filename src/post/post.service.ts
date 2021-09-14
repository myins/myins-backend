import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { ShallowUserSelect } from 'src/util/shallow-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async post(
    postWhereUniqueInput: Prisma.PostWhereUniqueInput,
    includeUserInfo: boolean,
  ): Promise<Post | null> {
    return this.prisma.post.findUnique({
      where: postWhereUniqueInput,
      include: includeUserInfo
        ? {
            author: {
              select: ShallowUserSelect,
            },
          }
        : null,
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
            id: asUserID,
          },
        },
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
