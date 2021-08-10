import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  async getStatus(): Promise<{ status: string }> {
    return {
      status: 'All good! v4',
    };
  }
}
