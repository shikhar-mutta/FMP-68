import { Controller, Get } from '@nestjs/common';
import axios from 'axios';

@Controller()
export class AppController {

  @Get()
  health() {
    return {
      message: 'gateway-service running',
    };
  }

  @Get('follow')
  async follow() {

    const response = await axios.get(
      'http://follow-request-service:3003/follow'
    );

    return response.data;
  }
}