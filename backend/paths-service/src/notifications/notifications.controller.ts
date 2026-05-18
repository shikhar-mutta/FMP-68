import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  @Get('mine')
  getMyNotifications(@CurrentUserId() userId: string) {
    return this.notificationsService.findForUser(userId);
  }

  @Delete(':id')
  dismiss(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.notificationsService.dismiss(id, userId);
  }

  @Post('_publish-test')
  @HttpCode(HttpStatus.ACCEPTED)
  publishTest(@Body() body: Record<string, unknown> = {}) {
    const payload = {
      type: 'test.spike',
      origin: 'paths-service:_publish-test',
      timestamp: new Date().toISOString(),
      ...body,
    };
    this.rabbitmq.publish('test.spike', payload);
    return { published: true, payload };
  }
}
