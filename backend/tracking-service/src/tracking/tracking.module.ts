import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { TrailCacheService } from './trail-cache.service';

@Module({
  providers: [TrackingService, TrailCacheService, TrackingGateway],
})
export class TrackingModule {}
