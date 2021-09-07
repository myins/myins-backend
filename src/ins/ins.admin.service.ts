import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsInteractionService } from './ins.interaction.service';

@Injectable()
export class InsAdminService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly insInteractionService: InsInteractionService
    ) { }

    async checkIfAdmin(userId: string, insId: string) {
        const connection = await this.insInteractionService.checkConnection(userId, insId)
        return connection?.isAdmin
    }

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
            message: "Admin changed!"
        }
    }

    async removeMember(insId: string, removeMemberId: string) {
        await this.insInteractionService.checkConnection(removeMemberId, insId)
        await this.prismaService.userInsConnection.delete({
            where: {
                userId_insId: {
                    userId: removeMemberId,
                    insId: insId
                }
            }
        })
        return {
            message: "Member removed from INS!"
        }
    }
}
