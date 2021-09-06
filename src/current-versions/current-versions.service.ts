import { CurrentVersions } from '.prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Injectable()
export class CurrentVersionsService {
    constructor(private prisma: PrismaService) { }

    async get(): Promise<CurrentVersions | null> {
        return this.prisma.currentVersions.findFirst({
            orderBy: {
                updatedAt: 'desc'
            },
        });
    }

    async changeTermsAndConditionsVersion(valuesVersions: ChangeCurrentVersionsAPI) {
        const lastVersions = await this.get()
        const data = lastVersions ? {
            termsAndConditionsVersion: 
                valuesVersions.isTermsAndConditionsVersionChanged ? undefined : lastVersions.termsAndConditionsVersion,
            privacyPolicyVersion:
                valuesVersions.isPrivacyPolicyVersionChanged ? undefined : lastVersions.privacyPolicyVersion,
        } : {}
        await this.prisma.currentVersions.create({data})
    }
}
