import { Controller, Delete, Get, Param } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('mine')
  getMyNotifications(@CurrentUserId() userId: string) {
    return this.notificationsService.findForUser(userId);
  }

  @Delete(':id')
  dismiss(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.notificationsService.dismiss(id, userId);
  }
}
