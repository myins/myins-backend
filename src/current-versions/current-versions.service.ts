import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Injectable()
export class CurrentVersionsService {
    constructor(private prisma: PrismaService) { }

    async get(isChanged?: boolean) {
        const currentVersionsValues = await this.prisma.currentVersions.findFirst({
            orderBy: {
                updatedAt: 'desc'
            },
        });
        if (!isChanged && currentVersionsValues == null) {
            throw new InternalServerErrorException('There is no current versions!');
        }
        return currentVersionsValues
    }

    async changeTermsAndConditionsVersion(valuesVersions: ChangeCurrentVersionsAPI) {
        const lastVersions = await this.get(true)
        const data = {
            termsAndConditionsVersion: 
                valuesVersions.isTermsAndConditionsVersionChanged ? undefined : lastVersions?.termsAndConditionsVersion,
            privacyPolicyVersion:
                valuesVersions.isPrivacyPolicyVersionChanged ? undefined : lastVersions?.privacyPolicyVersion,
        }
        await this.prisma.currentVersions.create({data})
        return {
            message: "Terms and conditions version successfully changed."
        }
    }
}
