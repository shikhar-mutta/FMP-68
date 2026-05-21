import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Coordinate } from './tracking.types';

const TRAIL_MAX = 200;
const TRAIL_TTL_SECONDS = 3600;

@Injectable()
export class TrailCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TrailCacheService');
  private client: any = null;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set — trail cache disabled, falling back to MongoDB');
      return;
    }

    // Lazy import so ioredis is only loaded when Redis is actually configured
    const Redis = require('ioredis');
    this.client = new Redis(url);
    this.client.on('error', (err: Error) =>
      this.logger.warn(`Redis client error: ${err.message}`),
    );
    this.client.on('ready', () =>
      this.logger.log(`Redis trail cache ready (${url})`),
    );
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch {
      this.client?.disconnect();
    }
  }

  async appendCoord(pathId: string, coord: Coordinate): Promise<void> {
    if (!this.client) return;
    const key = `trail:${pathId}`;
    try {
      await this.client
        .pipeline()
        .lpush(key, JSON.stringify(coord))
        .ltrim(key, 0, TRAIL_MAX - 1)
        .expire(key, TRAIL_TTL_SECONDS)
        .exec();
    } catch (err: any) {
      this.logger.warn(`appendCoord failed for ${key}: ${err.message}`);
    }
  }

  clearTrail(pathId: string): void {
    if (!this.client) return;
    this.client.del(`trail:${pathId}`).catch((err: Error) => {
      this.logger.warn(`clearTrail failed for ${pathId}: ${err.message}`);
    });
  }

  async getRecentTrail(pathId: string): Promise<Coordinate[]> {
    if (!this.client) return [];
    try {
      const raw = await this.client.lrange(`trail:${pathId}`, 0, -1);
      return raw.map((s: string) => JSON.parse(s) as Coordinate);
    } catch (err: any) {
      this.logger.warn(`getRecentTrail failed for ${pathId}: ${err.message}`);
      return [];
    }
  }
}
