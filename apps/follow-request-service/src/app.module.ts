import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { FollowRequestsModule } from './follow-requests/follow-requests.module';

@Module({
  imports: [
    PrismaModule,
    FollowRequestsModule,
  ],
})
export class AppModule {}