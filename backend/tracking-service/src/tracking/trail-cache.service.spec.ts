import { TrailCacheService } from './trail-cache.service';

// ioredis is mocked at the module level so `new Redis(url)` returns a
// fully-stubbed client. Each test reaches in via `(svc as any).client`
// to drive behaviour.
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    pipeline: jest.fn(),
    lrange: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  }));
  return { __esModule: true, default: RedisMock };
});

import Redis from 'ioredis';

describe('TrailCacheService', () => {
  let svc: TrailCacheService;
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
    svc = new TrailCacheService();
    svc.onModuleInit();
    client = (svc as any).client;
  });

  describe('onModuleInit', () => {
    it('constructs the Redis client with the default URL when REDIS_URL is unset', () => {
      expect(Redis).toHaveBeenCalledWith('redis://redis:6379');
    });

    it('honours REDIS_URL when present', () => {
      (Redis as unknown as jest.Mock).mockClear();
      process.env.REDIS_URL = 'redis://custom:1234';
      const s = new TrailCacheService();
      s.onModuleInit();
      expect(Redis).toHaveBeenCalledWith('redis://custom:1234');
    });

    it('registers "error" and "ready" listeners on the client', () => {
      const events = (client.on.mock.calls as [string, Function][]).map(
        ([ev]) => ev,
      );
      expect(events).toEqual(expect.arrayContaining(['error', 'ready']));

      // Invoke the handlers to cover the warn/log bodies.
      const errHandler = client.on.mock.calls.find(
        ([ev]: [string]) => ev === 'error',
      )![1] as (e: Error) => void;
      const readyHandler = client.on.mock.calls.find(
        ([ev]: [string]) => ev === 'ready',
      )![1] as () => void;
      expect(() => errHandler(new Error('boom'))).not.toThrow();
      expect(() => readyHandler()).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls client.quit() to shut the connection down cleanly', async () => {
      client.quit.mockResolvedValue(undefined);
      await svc.onModuleDestroy();
      expect(client.quit).toHaveBeenCalled();
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to disconnect() when quit() rejects', async () => {
      client.quit.mockRejectedValue(new Error('quit-failed'));
      await svc.onModuleDestroy();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('is a no-op when client is missing', async () => {
      (svc as any).client = undefined;
      await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('appendCoord', () => {
    const coord = { lat: 1, lng: 2, timestamp: 123 };

    it('pipelines lpush + ltrim + expire and resolves', async () => {
      const exec = jest.fn().mockResolvedValue([]);
      const expire = jest.fn().mockReturnValue({ exec });
      const ltrim = jest.fn().mockReturnValue({ expire });
      const lpush = jest.fn().mockReturnValue({ ltrim });
      client.pipeline.mockReturnValue({ lpush });

      await svc.appendCoord('p1', coord);

      expect(lpush).toHaveBeenCalledWith('trail:p1', JSON.stringify(coord));
      expect(ltrim).toHaveBeenCalledWith('trail:p1', 0, 199);
      expect(expire).toHaveBeenCalledWith('trail:p1', 3600);
      expect(exec).toHaveBeenCalled();
    });

    it('swallows Redis errors so a cache outage cannot break broadcast', async () => {
      client.pipeline.mockImplementation(() => {
        throw new Error('redis-down');
      });
      await expect(svc.appendCoord('p1', coord)).resolves.toBeUndefined();
    });
  });

  describe('getRecentTrail', () => {
    it('returns parsed coordinates from lrange', async () => {
      const a = { lat: 1, lng: 1, timestamp: 1 };
      const b = { lat: 2, lng: 2, timestamp: 2 };
      client.lrange.mockResolvedValue([JSON.stringify(a), JSON.stringify(b)]);

      await expect(svc.getRecentTrail('p1')).resolves.toEqual([a, b]);
      expect(client.lrange).toHaveBeenCalledWith('trail:p1', 0, -1);
    });

    it('returns an empty list when Redis throws', async () => {
      client.lrange.mockRejectedValue(new Error('redis-down'));
      await expect(svc.getRecentTrail('p1')).resolves.toEqual([]);
    });

    it('returns an empty list when the cache is empty', async () => {
      client.lrange.mockResolvedValue([]);
      await expect(svc.getRecentTrail('p1')).resolves.toEqual([]);
    });
  });
});
