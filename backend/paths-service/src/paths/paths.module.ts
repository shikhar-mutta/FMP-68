import { Module } from '@nestjs/common';
import { PathsService } from './paths.service';
import { PathsController } from './paths.controller';
import { UsersClientModule } from '../users-client/users-client.module';
import { PathFollowersService } from './path-followers.service';
import { PathsRepository } from './paths.repository';

@Module({
  imports: [UsersClientModule],
  providers: [PathsRepository, PathFollowersService, PathsService],
  controllers: [PathsController],
  exports: [PathsRepository, PathFollowersService, PathsService],
})
export class PathsModule {}
