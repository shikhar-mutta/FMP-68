import { Controller, Get } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Controller()
export class AppController {

  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
        queue: 'follow_requests',
        queueOptions: {
          durable: false,
        },
      },
    });
  }

  @Get('follow')
  async createFollowRequest() {

    const event = {
      followerId: 'user1',
      followingId: 'user2',
      timestamp: Date.now(),
    };

    this.client.emit('follow_request_created', event);

    return {
      message: 'event emitted',
      event,
    };
  }
}