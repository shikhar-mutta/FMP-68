import { Module } from '@nestjs/common';
import { PathsService } from './paths.service';
import { PathsController } from './paths.controller';

@Module({
  providers: [PathsService],
  controllers: [PathsController],
})
export class PathsModule {}
