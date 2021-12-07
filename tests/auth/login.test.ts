import { NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/auth/auth.controller';
import { prismaMock } from 'tests/prisma-mock';
import { userMock } from 'tests/__mocks__/user';
import { getAuthTestingModule } from './test-module';

describe('[AuthController] POST /login', () => {
  let authController: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await getAuthTestingModule();
    authController = module.get<AuthController>(AuthController);
  });

  test('[login] return NotFoundException(Could not find user!)', async () => {
    prismaMock.user.update.mockResolvedValue(userMock);
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect.assertions(2);
    try {
      await authController.login(
        {
          user: userMock,
        },
        { pushToken: 'pushToken', isSandbox: false },
      );
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect(e).toHaveProperty('message', 'Could not find user!');
    }
  });
});
