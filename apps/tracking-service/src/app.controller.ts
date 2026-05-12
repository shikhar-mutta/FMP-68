import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {

  @EventPattern('follow_request_created')
  handleFollowRequest(@Payload() data: any) {

    console.log('FOLLOW REQUEST EVENT RECEIVED');

    console.log(data);
  }
}