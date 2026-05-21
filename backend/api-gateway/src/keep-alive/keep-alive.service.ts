import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Ping MongoDB every 14 minutes to prevent Atlas M0 free-tier auto-pause
  @Cron('0 */14 * * * *')
  async pingMongo() {
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      this.logger.debug('MongoDB keep-alive ping OK');
    } catch (err) {
      this.logger.warn(`MongoDB keep-alive ping failed: ${err?.message}`);
    }
  }
}
