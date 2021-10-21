import { CurrentVersions, DocumentType } from '.prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { Links } from 'src/current-versions/current-versions-api.entity';
import { CurrentVersionsController } from 'src/current-versions/current-versions.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaMock } from 'tests/prisma-mock';

describe('CurrentVersionsService', () => {
  let currentVersionsController: CurrentVersionsController;

  const currentVersionsMock: CurrentVersions[] = [
    {
      type: DocumentType.TERMS_AND_CONDITIONS,
      updatedAt: new Date('2021-10-15 15:07:11.819'),
      link: 'link.termAndConditions',
    },
    {
      type: DocumentType.PRIVACY_POLICY,
      updatedAt: new Date('2021-10-20 15:07:11.819'),
      link: 'link.privacyPolicy',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentVersionsController,
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

  it('getLinks', async () => {
    const expectedResult: Links = {
      TC: currentVersionsMock.find(
        (cv) => cv.type === DocumentType.TERMS_AND_CONDITIONS,
      )?.link,
      PP: currentVersionsMock.find(
        (cv) => cv.type === DocumentType.PRIVACY_POLICY,
      )?.link,
    };

    prismaMock.currentVersions.findMany.mockResolvedValue(currentVersionsMock);

    await expect(currentVersionsController.getLinks()).resolves.toEqual(
      expectedResult,
    );
  });
});
