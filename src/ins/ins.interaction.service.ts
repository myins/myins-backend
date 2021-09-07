import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { INS, Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomCode } from 'src/util/random';
import { CreateINSAPI } from './ins-api.entity';
import { retry } from 'ts-retry-promise';

@Injectable()
export class InsInteractionService {
    constructor(private readonly prismaService: PrismaService) { }

    async checkConnection(userId: string, insId: string)  {
        const connection = await this.prismaService.userInsConnection.findUnique({
            where: {
                userId_insId: {
                    userId: userId,
                    insId: insId
                }
            }
        })
        if(!connection) {
            throw new NotFoundException('Connection between user and INS not found')
        }

        return connection
    }

    async interact(userId: string, insId: string) {
        await this.prismaService.userInsConnection.update({
            where: {
                userId_insId: {
                    userId: userId,
                    insId: insId
                }
            },
            data: {
                interactions: {
                    increment: 1
                }
            }
        })
    }

    async interactPost(userId: string, postId: string) {
        const postWithIns = await this.prismaService.post.findUnique({
            where: {
                id: postId
            },
            include: {
                inses: {
                    select: {
                        id: true
                    }
                }
            }
        });
        if (!postWithIns) {
            throw new BadRequestException("Invalid post ID!");
        }
        const insIDs = postWithIns.inses.map(each => each.id)
        return this.prismaService.userInsConnection.updateMany({
            where: {
                insId: {
                    in: insIDs
                },
                userId: userId
            },
            data: {
                interactions: {
                    increment: 1
                }
            }
        })
    }

    async interactComment(userId: string, commentId: string) {
        const postWithIns = await this.prismaService.comment.findUnique({
            where: {
                id: commentId
            },
            include: {
                post: {
                    select: {
                        inses: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            }
        });
        if (!postWithIns) {
            throw new BadRequestException("Invalid post ID!");
        }
        const insIDs = postWithIns.post.inses.map(each => each.id)
        return this.prismaService.userInsConnection.updateMany({
            where: {
                insId: {
                    in: insIDs
                },
                userId: userId
            },
            data: {
                interactions: {
                    increment: 1
                }
            }
        })
    }


}
