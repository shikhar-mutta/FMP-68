import { Module } from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { FollowRequestsController } from './follow-requests.controller';
import { PathsModule } from '../paths/paths.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PathsModule, UsersModule],
  providers: [FollowRequestsService],
  controllers: [FollowRequestsController],
  exports: [FollowRequestsService],
})
export class FollowRequestsModule {}
