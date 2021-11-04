import { DocumentType } from '.prisma/client';
import { TestingModule } from '@nestjs/testing';
import { Links } from 'src/current-versions/current-versions-api.entity';
import { CurrentVersionsController } from 'src/current-versions/current-versions.controller';
import { prismaMock } from 'tests/prisma-mock';
import { currentVersionsMock } from 'tests/__mocks__/current-versions';
import { getCurrentVersionsTestingModule } from './test-module';

describe('[CurrentVersionsController] GET /current-versions/links', () => {
  let currentVersionsController: CurrentVersionsController;

  beforeEach(async () => {
    const module: TestingModule = await getCurrentVersionsTestingModule();
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
