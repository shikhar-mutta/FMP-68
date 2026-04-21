import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// UsersController intentionally removed — /users routes are served by user-service (port 4002)
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
