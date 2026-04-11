import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TrackingGateway],
})
export class TrackingModule {}
