import { Module } from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { FollowRequestsController } from './follow-requests.controller';
import { PathsModule } from '../paths/paths.module';
import { UsersClientModule } from '../users-client/users-client.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PathsModule, UsersClientModule, NotificationsModule],
  providers: [FollowRequestsService],
  controllers: [FollowRequestsController],
  exports: [FollowRequestsService],
})
export class FollowRequestsModule {}
