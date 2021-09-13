import { DocumentType } from '.prisma/client';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Injectable()
export class CurrentVersionsService {
    constructor(private prisma: PrismaService) { }

    async get(type: DocumentType) {
        const currentVersionsValues = await this.prisma.currentVersions.findUnique({
            where: {
                type: type
            }
        });
        if (currentVersionsValues == null) {
            throw new InternalServerErrorException('There is no current version!');
        }
        return currentVersionsValues
    }

    async changeDocumentVersion(valuesVersions: ChangeCurrentVersionsAPI) {
        await this.prisma.currentVersions.upsert({
            where: {
                type: valuesVersions.documentType
            },
            create: {
                type: valuesVersions.documentType,
            },
            update: {
                updatedAt: (new Date())
            }
        })
    }
}
