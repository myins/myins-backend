import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { INS, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomCode } from 'src/util/random';
import { CreateINSAPI } from './ins-api.entity';
import { retry } from 'ts-retry-promise';

@Injectable()
export class InsService {
    constructor(private readonly prismaService: PrismaService) { }

    async createINS(userID: string | null, data: CreateINSAPI) {
        const user = userID ? await this.prismaService.user.findUnique({ where: { id: userID } }) : null
        if (!user && userID) {
            throw new UnauthorizedException("You're not allowed to do this!")
        }
        if (!user?.phoneNumberVerified && userID) {
            throw new UnauthorizedException("You're not allowed to do this!")
        }
        // Retry it a couple of times in case the code is taken

        return retry(() => this.prismaService.iNS.create({
            data: {
                name: data.name,
                shareCode: randomCode(6),
                members: userID ? {
                    create: {
                        userId: userID
                    }
                } : undefined
            }
        }), { retries: 3 })
    }

    async insList(userID: string, skip: number, take: number, filter: string) {
        // First we get all the user's ins connections, ordered by his interaction count
        const connectionQuery = await this.prismaService.userInsConnection.findMany({
            where: {
                userId: userID,
                ins: (filter && filter.length > 0) ? {
                    name: {
                        contains: filter,
                        mode: 'insensitive'
                    }
                } : undefined
            },
            orderBy: {
                interactions: 'desc'
            }
        })
        const onlyIDs = connectionQuery.map(each => each.insId)

        // Now get all the inses, using the in query
        const toRet = await this.prismaService.iNS.findMany({
            where: {
                id: {
                    in: onlyIDs
                }
            },
        })

        // And finally sort the received inses by their position in the onlyIDs array
        const orderedByIDs = onlyIDs.map(each => {
            return toRet.find(each2 => each2.id == each)
        }).filter(each => { return each !== undefined })
        
        return orderedByIDs
    }

    async mediaForIns(insID: string, skip: number, take: number) {
        if (!insID || insID.length == 0) {
            throw new BadRequestException("Invalid ins ID!")
        }
        return this.prismaService.postContent.findMany({
            where: {
                post: {
                    inses: {
                        some: {
                            id: insID
                        }
                    }
                }
            },
            skip: skip,
            take: take,
            orderBy: {
                createdAt: 'desc'
            }
        })
    }

    async membersForIns(insID: string, skip: number, take: number, filter: string) {
        //console.log(`Members for ins: ${insID}`)
        return this.prismaService.user.findMany({
            where: {
                inses: {
                    some: {
                        insId: insID
                    }
                },
                OR: (filter && filter.length > 0) ? {
                    firstName: {
                        contains: filter,
                        mode: 'insensitive'
                    },
                    lastName: {
                        contains: filter,
                        mode: 'insensitive'
                    }
                } : undefined
            },
            skip: skip,
            take: take,
            orderBy: {
                firstName: 'desc'
            }
        })
    }

    async ins(where: Prisma.INSWhereUniqueInput, include?: Prisma.INSInclude) {
        return this.prismaService.iNS.findUnique({ where: where, include: include })
    }


    async inses(params: {
        skip?: number;
        take?: number;
        where?: Prisma.INSWhereInput;
        orderBy?: Prisma.INSOrderByInput;
        include?: Prisma.INSInclude
    }): Promise<INS[]> {
        const { skip, take, where, orderBy, include } = params;
        return this.prismaService.iNS.findMany({
            skip,
            take,
            where,
            orderBy,
            include: include,
        });
    }

    //FIXME: figure out type safety with select statements
    async insesSelectIDs(where: Prisma.INSWhereInput) {
        const toRet = await this.prismaService.iNS.findMany({
            where: where, select: {
                id: true
            }
        })
        return toRet
    }

    async update(params: {
        where: Prisma.INSWhereUniqueInput;
        data: Prisma.INSUpdateInput;
    }): Promise<INS> {
        const { where, data } = params;
        return this.prismaService.iNS.update({
            data,
            where,
        });
    }

}
