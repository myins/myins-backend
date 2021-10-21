import { Test, TestingModule } from '@nestjs/testing';
import { InteractionyyyService } from './interactionyyy.service';

describe('InteractionyyyService', () => {
  let service: InteractionyyyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InteractionyyyService],
    }).compile();

    service = module.get<InteractionyyyService>(InteractionyyyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
