import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { FollowRequestsController } from './follow-requests.controller';
import { FollowRequestsService } from './follow-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [FollowRequestsController],
  providers: [FollowRequestsService],
})
export class FollowRequestsModule {}