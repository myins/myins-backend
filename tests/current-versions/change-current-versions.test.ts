import { CurrentVersions, DocumentType } from '.prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { CurrentVersionsController } from 'src/current-versions/current-versions.controller';
import { CurrentVersionsService } from 'src/current-versions/current-versions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaMock } from 'tests/prisma-mock';
import { currentVersionPPMock, currentVersionTCMock } from './__mocks__';

describe('[CurrentVersionsController] POST /current-versions', () => {
  let currentVersionsController: CurrentVersionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentVersionsController,
        CurrentVersionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    currentVersionsController = module.get<CurrentVersionsController>(
      CurrentVersionsController,
    );
  });

  it(`[changeCurrentVersions] return changed current versions by document type ${DocumentType.TERMS_AND_CONDITIONS}`, async () => {
    const expectedResult: CurrentVersions = currentVersionTCMock;
    prismaMock.currentVersions.upsert.mockResolvedValue(expectedResult);

    const result = await currentVersionsController.changeCurrentVersions({
      documentType: DocumentType.TERMS_AND_CONDITIONS,
    });

    expect(result.updatedAt.getTime()).toEqual(
      expectedResult.updatedAt.getTime(),
    );
  });

  it(`[changeCurrentVersions] return changed current versions by document type ${DocumentType.PRIVACY_POLICY}`, async () => {
    const expectedResult: CurrentVersions = currentVersionPPMock;
    prismaMock.currentVersions.upsert.mockResolvedValue(expectedResult);

    const result = await currentVersionsController.changeCurrentVersions({
      documentType: DocumentType.PRIVACY_POLICY,
    });

    expect(result.updatedAt.getTime()).toEqual(
      expectedResult.updatedAt.getTime(),
    );
  });
});
