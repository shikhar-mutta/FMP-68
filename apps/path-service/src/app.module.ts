import { Module } from '@nestjs/common';

import { PathsModule } from './paths/paths.module';

@Module({
  imports: [PathsModule],
})
export class AppModule {}