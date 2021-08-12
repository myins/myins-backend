import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Post, Prisma } from '@prisma/client';
import { ShallowUserSelect } from 'src/util/shallow-user';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) { }

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

  async injectedPost(
    postID: string,
    asUserID: string,
  ) {
    let toRet = await this.prisma.post.findUnique({
      where: {
        id: postID
      },
      include: {
        author: {
          select: ShallowUserSelect,
        },
        _count: {
          select: {
            likes: true,
            comments: true
          }
        },
        likes: {
          where: {
            id: asUserID
          }
        }
      }
    });
    return toRet
  }

  async posts(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PostWhereInput;
    orderBy?: Prisma.PostOrderByInput;
    includeUserInfo: boolean;
  }): Promise<Post[]> {
    const { skip, take, where, orderBy, includeUserInfo } = params;
    return this.prisma.post.findMany({
      skip,
      take,
      where,
      orderBy,
      include: includeUserInfo
        ? {
          author: {
            select: ShallowUserSelect,
          },
        }
        : null,
    });
  }

  async createPost(data: Prisma.PostCreateInput): Promise<Post> {
    const toRet = await this.prisma.post.create({
      data,
    });
    return toRet
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
    return toRet
  }

  async deletePost(postId: string): Promise<Post> {
    return this.prisma.post.delete({
      where: {
        id: postId,
      },
    });
  }

  //This call includes several relations, so is pretty expensive to call.
  async postsInjectedFeed(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PostWhereInput;
    orderBy?: Prisma.PostOrderByInput;
    asUserID: string;
  }): Promise<Post[]> {

    const { skip, take, where, orderBy, asUserID } = params;
    const toRet = await this.prisma.post.findMany({
      skip: skip,
      take: take,
      orderBy: orderBy,
      where: where,
      include: {
        _count: {
          select: {
            likes: true,
            comments: true
          },
        },
        likes: asUserID
          ? {
            where: {
              id: asUserID,
            },
            select: {
              id: true,
            },
          }
          : false,
        author: {
          select: ShallowUserSelect,
        },
      },
    });
    return toRet;
  }

}
