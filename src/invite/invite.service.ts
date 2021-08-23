import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';

@Injectable()
export class InviteService {
    constructor(private readonly prismaService: PrismaService, private readonly smsService: SmsService) { }

    async inviteExternalUser(userID: string, otherUserPhoneNumber: string, ins: string) {
        const theINS = await this.prismaService.iNS.findUnique({
            where: {
                id: ins,
            },
            include: {
                members: {
                    where: {
                        id: userID
                    },
                    select: {
                        id: true
                    }
                }
            }
        })
        if (!theINS || !theINS.members.includes({ id: userID })) {
            throw new BadRequestException("Could not find that INS!")
        }
        await this.smsService.sendSMS(otherUserPhoneNumber, `You've been invited to MyINS! Click this link to get the app: https://myins.com/join/${theINS.shareCode}`)

    }

    async inviteINSUser(userID: string, otherUser: string, ins: string) {
        const theINS = await this.prismaService.iNS.findUnique({
            where: {
                id: ins,
            },
            include: {
                members: {
                    where: {
                        id: userID
                    },
                    select: {
                        id: true
                    }
                }
            }
        })
        if (!theINS || !theINS.members.includes({ id: userID })) {
            throw new BadRequestException("Could not find that INS!")
        }
        await this.prismaService.iNS.update({
            where: {
                id: theINS.id
            },
            data: {
                members: {
                    connect: {
                        id: otherUser
                    }
                }
            }
        })
    }
}
