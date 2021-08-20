import { Injectable, UnauthorizedException } from '@nestjs/common';
import { INS, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomCode } from 'src/util/random';
import { CreateINSAPI } from './ins-api.entity';

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
        return this.prismaService.iNS.create({
            data: {
                name: data.name,
                shareCode: randomCode(6),
                members: userID ? {
                    connect: {
                        id: userID
                    }
                } : undefined
            }
        })
    }

    async ins(where: Prisma.INSWhereUniqueInput) {
        return this.prismaService.iNS.findUnique({where: where})
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
