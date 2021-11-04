import { Test, TestingModule } from '@nestjs/testing';
import { CurrentVersionsController } from 'src/current-versions/current-versions.controller';
import { CurrentVersionsService } from 'src/current-versions/current-versions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaMock } from 'tests/prisma-mock';

export const getCurrentVersionsTestingModule =
  async (): Promise<TestingModule> => {
    return Test.createTestingModule({
      providers: [
        CurrentVersionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
      controllers: [CurrentVersionsController],
    }).compile();
  };
