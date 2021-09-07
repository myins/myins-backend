import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InsAdminService {
    constructor(private readonly prismaService: PrismaService) { }

    async changeAdmin(userId: string, insId: string, newAdminId: string) {
        await this.prismaService.userInsConnection.update({
            where: {
                userId_insId: {
                    userId: userId,
                    insId: insId
                }
            },
            data: {
                isAdmin: false
            }
        })
        await this.prismaService.userInsConnection.update({
            where: {
                userId_insId: {
                    userId: newAdminId,
                    insId: insId
                }
            },
            data: {
                isAdmin: true
            }
        })
        return {
            message: "Admin changed"
        }
    }
}
