import { NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { InsController } from 'src/ins/ins.controller';
import { prismaMock } from 'tests/prisma-mock';
import { userMock } from 'tests/__mocks__/user';
import { getINSTestingModule } from './test-module';

describe('[InsController] POST /', () => {
  let iNSController: InsController;

  beforeEach(async () => {
    const module: TestingModule = await getINSTestingModule();
    iNSController = module.get<InsController>(InsController);
  });

  test('[createINS] return NotFoundException(Could not find this user!)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await iNSController.createINS(userMock.id, { name: 'new INS' });
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find this user!');
    }
  });
});
