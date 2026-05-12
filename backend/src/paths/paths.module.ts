import { Module } from '@nestjs/common';
import { PathsService } from './paths.service';
import { PathsController } from './paths.controller';
import { UsersModule } from '../users/users.module';
import { PathFollowersService } from './path-followers.service';
import { PathsRepository } from './paths.repository';

@Module({
  imports: [UsersModule],
  providers: [PathsRepository, PathFollowersService, PathsService],
  controllers: [PathsController],
  exports: [PathsRepository, PathFollowersService, PathsService],
})
export class PathsModule {}
