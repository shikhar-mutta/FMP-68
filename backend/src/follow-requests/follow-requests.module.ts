import { Module } from '@nestjs/common';
import { FollowRequestsService } from './follow-requests.service';
import { FollowRequestsController } from './follow-requests.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [FollowRequestsService],
  controllers: [FollowRequestsController],
  exports: [FollowRequestsService],
})
export class FollowRequestsModule {}
