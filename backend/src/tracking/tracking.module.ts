import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

@Module({
  providers: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
