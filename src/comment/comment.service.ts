import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Comment } from '@prisma/client';
import { PostService } from 'src/post/post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CommentWithPostWithInsesID,
  ShallowUserSelect,
} from 'src/util/prisma-queries-helper';

@Injectable()
export class CommentService {
  constructor(
    private prismaService: PrismaService,
    private postService: PostService,
  ) {}

  async createComment(data: Prisma.CommentCreateInput): Promise<Comment> {
    const toRet = await this.prismaService.comment.create({
      data,
    });
    return toRet;
  }

  async comments(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CommentWhereInput;
    orderBy?: Prisma.CommentOrderByWithRelationInput;
    include?: Prisma.CommentInclude;
  }) {
    const { skip, take, where, orderBy, include } = params;
    return this.prismaService.comment.findMany({
      skip,
      take,
      where,
      orderBy,
      include,
    });
  }

  async countComments(where: Prisma.CommentWhereInput) {
    return this.prismaService.comment.count({ where });
  }

  async comment(
    commentWhereUniqueInput: Prisma.CommentWhereUniqueInput,
    commentInclude?: Prisma.CommentInclude,
  ): Promise<(Comment | CommentWithPostWithInsesID) | null> {
    return this.prismaService.comment.findUnique({
      where: commentWhereUniqueInput,
      include: commentInclude,
    });
  }

  async updateComment(params: {
    where: Prisma.CommentWhereUniqueInput;
    data: Prisma.CommentUpdateInput;
  }): Promise<Comment> {
    return this.prismaService.comment.update(params);
  }

  async deleteComment(where: Prisma.CommentWhereUniqueInput) {
    return this.prismaService.comment.delete({
      where,
    });
  }

  async commentsForPost(
    postID: string,
    skip: number,
    take: number,
    userID: string,
  ) {
    const x = await this.postService.post({ id: postID }, false);
    if (x == null) {
      throw new BadRequestException('Could not find post!');
    }
    const toRet = await this.prismaService.comment.findMany({
      skip: skip,
      take: take,
      where: {
        postId: postID,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            likes: true,
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
        author: {
          select: ShallowUserSelect,
        },
      },
    });
    return toRet;
  }
}
