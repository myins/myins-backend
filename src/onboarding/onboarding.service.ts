import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OnboardingService {
    constructor(private readonly prismaService: PrismaService) { }

    private readonly logger = new Logger(OnboardingService.name);


    @Cron('0 1 * * *')
    async removeOldINS() {
        this.logger.log("Removing old unclaimed INSes..")
        var d = new Date();
        d.setDate(d.getDate() - 2);

        const res = await this.prismaService.iNS.deleteMany({
            where: {
                members: {
                    none: {}
                },
                createdAt: {
                    lt: d
            }
            }
        })
        this.logger.log(`Cleaned up ${res.count} unclaimed INSes!`)
    }

    async claimINS(insID: string, userID: string) {
        const ins = await this.prismaService.iNS.findUnique({
            where: {
                id: insID
            },
            include: {
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        })
        if (!ins || ins._count?.members != 0) {
            throw new BadRequestException("Could not find INS!")
        }

        await this.prismaService.$transaction(async (prisma) => {
            // First we connect the user to that INS
            await prisma.iNS.update({
                where: {
                    id: insID
                },
                data: {
                    members: {
                        create: {
                            userId: userID
                        }
                    }
                }
            })
            //Then we also make him the owner of all the posts (should be one post)
            await this.prismaService.post.updateMany({
                where: {
                    inses: {
                        some: {
                            id: ins.id
                        }
                    },
                    authorId: null
                },
                data: {
                    authorId: userID
                }
            })
        })
    }

}
