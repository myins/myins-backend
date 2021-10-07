import { CurrentVersions, Prisma } from '.prisma/client';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeCurrentVersionsAPI } from './current-versions-api.entity';

@Injectable()
export class CurrentVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByType(
    where: Prisma.CurrentVersionsWhereUniqueInput,
  ): Promise<CurrentVersions> {
    const currentVersionsValues = await this.prisma.currentVersions.findUnique({
      where,
    });
    if (currentVersionsValues == null) {
      throw new InternalServerErrorException('There is no current version!');
    }
    return currentVersionsValues;
  }

  async changeDocumentVersion(
    valuesVersions: ChangeCurrentVersionsAPI,
  ): Promise<CurrentVersions> {
    return this.prisma.currentVersions.upsert({
      where: {
        type: valuesVersions.documentType,
      },
      create: {
        type: valuesVersions.documentType,
      },
      update: {
        updatedAt: new Date(),
      },
    });
  }
}
