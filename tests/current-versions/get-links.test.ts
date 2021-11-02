import { DocumentType } from '.prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { Links } from 'src/current-versions/current-versions-api.entity';
import { CurrentVersionsController } from 'src/current-versions/current-versions.controller';
import { CurrentVersionsService } from 'src/current-versions/current-versions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaMock } from 'tests/prisma-mock';
import { currentVersionsMock } from 'tests/__mocks__/current-versions';

describe('[CurrentVersionsController] GET /current-versions/links', () => {
  let currentVersionsController: CurrentVersionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrentVersionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
      controllers: [CurrentVersionsController],
    }).compile();

    currentVersionsController = module.get<CurrentVersionsController>(
      CurrentVersionsController,
    );
  });

  test('[getLinks] return links for TC and PP', async () => {
    const expectedResult: Links = {
      TC: currentVersionsMock.find(
        (cv) => cv.type === DocumentType.TERMS_AND_CONDITIONS,
      )?.link,
      PP: currentVersionsMock.find(
        (cv) => cv.type === DocumentType.PRIVACY_POLICY,
      )?.link,
    };
    prismaMock.currentVersions.findMany.mockResolvedValue(currentVersionsMock);

    const result = await currentVersionsController.getLinks();

    expect(result).toEqual(expectedResult);
  });
});
