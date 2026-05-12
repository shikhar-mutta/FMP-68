import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PathsModule } from './paths/paths.module';
import { FollowRequestsModule } from './follow-requests/follow-requests.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PathsModule,
    FollowRequestsModule,
    TrackingModule,
  ],
})
export class AppModule {}
