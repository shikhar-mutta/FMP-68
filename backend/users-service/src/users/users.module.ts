import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersInternalController } from './users-internal.controller';

@Module({
  providers: [UsersRepository, UsersService],
  controllers: [UsersController, UsersInternalController],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
