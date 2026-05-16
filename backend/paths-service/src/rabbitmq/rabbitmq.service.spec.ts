import * as amqplib from 'amqplib';
import { FMP_NOTIFICATIONS_EXCHANGE, RabbitmqService } from './rabbitmq.service';

jest.mock('amqplib');

describe('RabbitmqService', () => {
  let mockChannel: any;
  let mockConnection: any;
  let svc: RabbitmqService;

  beforeEach(() => {
    // resetAllMocks (vs clearAllMocks) also drops leftover *Once queues
    // from a prior test, so each test starts from a clean impl.
    jest.resetAllMocks();
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockConnection = {
      on: jest.fn(),
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqplib.connect as jest.Mock).mockResolvedValue(mockConnection);
    svc = new RabbitmqService();
  });

  afterEach(async () => {
    await svc.onModuleDestroy();
  });

  it('asserts the topic exchange on connect', async () => {
    await (svc as any).connect();
    expect(amqplib.connect).toHaveBeenCalledWith(
      expect.stringMatching(/^amqp:\/\//),
    );
    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      FMP_NOTIFICATIONS_EXCHANGE,
      'topic',
      { durable: true },
    );
  });

  it('publishes JSON payload with persistent flag + routing key', async () => {
    await (svc as any).connect();
    svc.publish('user.followed', { actorId: '1', targetId: '2' });

    expect(mockChannel.publish).toHaveBeenCalledWith(
      FMP_NOTIFICATIONS_EXCHANGE,
      'user.followed',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'application/json',
        persistent: true,
      }),
    );
    const buf: Buffer = mockChannel.publish.mock.calls[0][2];
    expect(JSON.parse(buf.toString('utf8'))).toEqual({
      actorId: '1',
      targetId: '2',
    });
  });

  it('drops silently when channel is not ready', () => {
    expect(() => svc.publish('any.key', { x: 1 })).not.toThrow();
    expect(mockChannel.publish).not.toHaveBeenCalled();
  });

  it('does not throw when broker publish itself fails', async () => {
    await (svc as any).connect();
    mockChannel.publish.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => svc.publish('user.followed', { id: 1 })).not.toThrow();
  });

  it('publish catch handles non-Error throws (err?.message ?? err fallback)', async () => {
    await (svc as any).connect();
    mockChannel.publish.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain-string-error';
    });
    expect(() => svc.publish('user.followed', { id: 1 })).not.toThrow();
  });

  it('onModuleInit fires off the connect handshake', async () => {
    await svc.onModuleInit();
    // onModuleInit calls connect() but does not await it — let the
    // scheduled microtask resolve before asserting.
    await new Promise((r) => setImmediate(r));
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy swallows channel.close() and connection.close() errors', async () => {
    await (svc as any).connect();
    mockChannel.close.mockRejectedValueOnce(new Error('chan-close-fail'));
    mockConnection.close.mockRejectedValueOnce(new Error('conn-close-fail'));
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('registers and survives the connection "error" event handler', async () => {
    await (svc as any).connect();
    const errorHandler = mockConnection.on.mock.calls.find(
      ([ev]: [string]) => ev === 'error',
    )[1];
    expect(typeof errorHandler).toBe('function');
    expect(() => errorHandler(new Error('upstream-blew-up'))).not.toThrow();
    // Branch: error object without a .message field falls back to err itself.
    expect(() => errorHandler('plain-string-error')).not.toThrow();
  });

  it('reconnects on "close" event when not destroyed', async () => {
    jest.useFakeTimers();
    try {
      await (svc as any).connect();
      const closeHandler = mockConnection.on.mock.calls.find(
        ([ev]: [string]) => ev === 'close',
      )[1];

      // Trigger the close — channel/connection should be cleared and a
      // 5-second reconnect scheduled.
      closeHandler();
      expect((svc as any).channel).toBeNull();
      expect((svc as any).connection).toBeNull();

      // Advance the clock past the 5-second retry window and let the
      // re-invoked connect() resolve.
      (amqplib.connect as jest.Mock).mockResolvedValue(mockConnection);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(amqplib.connect).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT reconnect on "close" once the service is destroyed', async () => {
    await (svc as any).connect();
    const closeHandler = mockConnection.on.mock.calls.find(
      ([ev]: [string]) => ev === 'close',
    )[1];

    // Mark destroyed (as onModuleDestroy would) before the close fires.
    (svc as any).destroyed = true;
    (amqplib.connect as jest.Mock).mockClear();
    closeHandler();
    // No retry should be scheduled.
    jest.useFakeTimers();
    try {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
      expect(amqplib.connect).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries connect() after amqplib.connect() rejects', async () => {
    jest.useFakeTimers();
    try {
      (amqplib.connect as jest.Mock)
        .mockRejectedValueOnce(new Error('broker-down'))
        .mockResolvedValueOnce(mockConnection);

      await (svc as any).connect();
      // First attempt rejected → channel stays null.
      expect((svc as any).channel).toBeNull();

      // Advance 5s for the scheduled retry; the second call resolves.
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(amqplib.connect).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('handles non-Error rejection values in the connect() catch path', async () => {
    (amqplib.connect as jest.Mock).mockRejectedValueOnce('plain-string-error');
    (svc as any).destroyed = true; // skip the 5-second retry setTimeout
    await expect((svc as any).connect()).resolves.toBeUndefined();
    expect((svc as any).channel).toBeNull();
  });

  it('catches mid-flight failures (createChannel/assertExchange) inside connect()', async () => {
    // amqplib.connect resolves but a downstream call inside the try-block
    // throws — exercises the catch from a different control-flow path.
    mockConnection.createChannel.mockRejectedValueOnce(
      new Error('createChannel-failed'),
    );
    (svc as any).destroyed = true; // skip retry timer
    await (svc as any).connect();
    expect((svc as any).channel).toBeNull();
  });

  it('connect() is reentrancy-safe (no double-connect while already connecting/connected)', async () => {
    await (svc as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    // Second call must early-return because channel is set.
    await (svc as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    // And once destroyed, connect() is a no-op too.
    (svc as any).destroyed = true;
    (svc as any).channel = null;
    await (svc as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
  });
});
