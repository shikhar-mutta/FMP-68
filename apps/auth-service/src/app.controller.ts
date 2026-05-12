import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {

  @Get()
  health() {
    return {
      service: 'auth-service',
      status: 'running',
    };
  }
}