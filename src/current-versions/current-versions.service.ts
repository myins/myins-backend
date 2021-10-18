import { CurrentVersions, DocumentType, Prisma } from '.prisma/client';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeCurrentVersionsAPI, Links } from './current-versions-api.entity';

@Injectable()
export class CurrentVersionsService {
  private readonly logger = new Logger(CurrentVersionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getByType(
    where: Prisma.CurrentVersionsWhereUniqueInput,
  ): Promise<CurrentVersions> {
    const currentVersionsValues = await this.prisma.currentVersions.findUnique({
      where,
    });
    if (!currentVersionsValues) {
      this.logger.error('There is no current version!');
      throw new InternalServerErrorException('There is no current version!');
    }
    return currentVersionsValues;
  }

  async getLinks(): Promise<Links> {
    const currentVersions = await this.prisma.currentVersions.findMany({
      select: {
        type: true,
        link: true,
      },
    });
    return {
      TC: currentVersions.find(
        (currentVersion) =>
          currentVersion.type === DocumentType.TERMS_AND_CONDITIONS,
      )?.link,
      PP: currentVersions.find(
        (currentVersion) => currentVersion.type === DocumentType.PRIVACY_POLICY,
      )?.link,
    };
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
