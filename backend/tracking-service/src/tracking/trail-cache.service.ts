import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Coordinate } from './tracking.types';

const TRAIL_MAX = 200;
const TRAIL_TTL_SECONDS = 3600;

@Injectable()
export class TrailCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TrailCacheService');
  private client!: Redis;

  onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://redis:6379';
    // Default ioredis settings: connect eagerly, buffer commands until
    // ready (enableOfflineQueue defaults to true). That way the first
    // send-location event after boot still gets cached even if the TCP
    // handshake hasn't completed yet.
    this.client = new Redis(url);
    this.client.on('error', (err) =>
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

  /**
   * Append a coordinate to the per-path trail and refresh the TTL.
   * Best-effort: a Redis outage must never break the live-broadcast path.
   */
  async appendCoord(pathId: string, coord: Coordinate): Promise<void> {
    const key = `trail:${pathId}`;
    try {
      await this.client
        .pipeline()
        .lpush(key, JSON.stringify(coord))
        .ltrim(key, 0, TRAIL_MAX - 1)
        .expire(key, TRAIL_TTL_SECONDS)
        .exec();
    } catch (err) {
      this.logger.warn(`appendCoord failed for ${key}: ${(err as Error).message}`);
    }
  }

  /**
   * Returns the most recent coordinates for a path, newest first.
   * Empty list on cache miss or Redis outage.
   */
  async getRecentTrail(pathId: string): Promise<Coordinate[]> {
    try {
      const raw = await this.client.lrange(`trail:${pathId}`, 0, -1);
      return raw.map((s) => JSON.parse(s) as Coordinate);
    } catch (err) {
      this.logger.warn(`getRecentTrail failed for ${pathId}: ${(err as Error).message}`);
      return [];
    }
  }
}
