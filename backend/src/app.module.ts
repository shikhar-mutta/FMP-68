// Global error handling and middleware configuration
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PathsModule } from './paths/paths.module';
import { FollowRequestsModule } from './follow-requests/follow-requests.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // Prisma (global)
    PrismaModule,

    // Passport
    PassportModule.register({ defaultStrategy: 'google' }),

    AuthModule,
    UsersModule,
    PathsModule,
    FollowRequestsModule,
    TrackingModule,
  ],
})
export class AppModule {}
