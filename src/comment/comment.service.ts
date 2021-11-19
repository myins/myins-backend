import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Comment } from '@prisma/client';
import { PostService } from 'src/post/post.service';
import { ShallowUserSelect } from 'src/prisma-queries-helper/shallow-user-select';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly postService: PostService,
  ) {}

  async createComment(data: Prisma.CommentCreateInput): Promise<Comment> {
    return this.prismaService.comment.create({
      data,
    });
  }

  async comments(params: Prisma.CommentFindManyArgs): Promise<Comment[]> {
    return this.prismaService.comment.findMany(params);
  }

  async countComments(where: Prisma.CommentWhereInput): Promise<number> {
    return this.prismaService.comment.count({ where });
  }

  async comment(
    commentWhereUniqueInput: Prisma.CommentWhereUniqueInput,
    commentInclude?: Prisma.CommentInclude,
  ): Promise<Comment | null> {
    return this.prismaService.comment.findUnique({
      where: commentWhereUniqueInput,
      include: commentInclude,
    });
  }

  async updateComment(params: Prisma.CommentUpdateArgs): Promise<Comment> {
    return this.prismaService.comment.update(params);
  }

  async deleteComment(where: Prisma.CommentWhereUniqueInput): Promise<Comment> {
    return this.prismaService.comment.delete({
      where,
    });
  }

  async deleteManyComments(params: Prisma.CommentDeleteManyArgs) {
    return this.prismaService.comment.deleteMany(params);
  }

  async commentsForPost(
    postID: string,
    skip: number,
    take: number,
    userID: string,
  ) {
    const x = await this.postService.post({ id: postID });
    if (x == null) {
      this.logger.error(`Could not find post ${postID}!`);
      throw new NotFoundException('Could not find post!');
    }
    return this.comments({
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
  }
}
