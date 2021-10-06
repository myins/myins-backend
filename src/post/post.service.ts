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

  async posts(params: Prisma.PostFindManyArgs) {
    return this.prisma.post.findMany(params);
  }

  async postsWithRelatedInfo(params: Prisma.PostFindManyArgs) {
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

  async updatePost(params: {
    where: Prisma.PostWhereUniqueInput;
    data: Prisma.PostUpdateInput;
  }): Promise<Post> {
    const { data, where } = params;
    return this.prisma.post.update({
      data,
      where,
    });
  }

  async updateManyPosts(params: Prisma.PostUpdateManyArgs) {
    return this.prisma.post.updateMany(params);
  }

  async deletePost(postId: string): Promise<Post> {
    return this.prisma.post.delete({
      where: {
        id: postId,
      },
    });
  }
}
