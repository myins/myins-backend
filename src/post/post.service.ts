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

  async injectedPost(postID: string, asUserID: string): Promise<Post | null> {
    return this.post(
      {
        id: postID,
      },
      {
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
}
