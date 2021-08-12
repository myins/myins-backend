import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomCode } from 'src/util/random';
import { CreateINSAPI } from './ins-api.entity';

@Injectable()
export class InsService {
    constructor(private readonly prismaService: PrismaService) { }

    async createINS(userID: string, data: CreateINSAPI) {
        const user = await this.prismaService.user.findUnique({ where: { id: userID } })
        if (!user) {
            throw new UnauthorizedException("You're not allowed to do this!")
        }
        if (!user.phoneNumberVerified) {
            throw new UnauthorizedException("You're not allowed to do this!")
        }
        return this.prismaService.iNS.create({
            data: {
                name: data.name,
                shareCode: randomCode(6),
                members: {
                    connect: {
                        id: userID
                    }
                }
            }
        })
    }

}
