import { Module } from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { FollowRequestsController } from './follow-requests.controller';

@Module({
  providers: [FollowRequestsService],
  controllers: [FollowRequestsController],
})
export class FollowRequestsModule {}
