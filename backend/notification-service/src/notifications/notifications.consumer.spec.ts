import * as amqplib from 'amqplib';
import {
  FMP_NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_QUEUE,
  NotificationsConsumer,
} from './notifications.consumer';

jest.mock('amqplib');

describe('NotificationsConsumer', () => {
  let mockChannel: any;
  let mockConnection: any;
  let consumer: NotificationsConsumer;

  beforeEach(() => {
    // resetAllMocks (vs clearAllMocks) also drops any leftover *Once queue
    // from a prior test, so each test starts with a clean mock impl.
    jest.resetAllMocks();
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockConnection = {
      on: jest.fn(),
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqplib.connect as jest.Mock).mockResolvedValue(mockConnection);
    consumer = new NotificationsConsumer();
  });

  afterEach(async () => {
    await consumer.onModuleDestroy();
  });

  it('asserts exchange + durable queue + catch-all binding on connect', async () => {
    await (consumer as any).connect();

    expect(amqplib.connect).toHaveBeenCalledWith(
      expect.stringMatching(/^amqp:\/\//),
    );
    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      FMP_NOTIFICATIONS_EXCHANGE,
      'topic',
      { durable: true },
    );
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE, {
      durable: true,
    });
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      NOTIFICATIONS_QUEUE,
      FMP_NOTIFICATIONS_EXCHANGE,
      '#',
    );
    expect(mockChannel.consume).toHaveBeenCalledWith(
      NOTIFICATIONS_QUEUE,
      expect.any(Function),
    );
  });

  it('acks valid JSON messages', async () => {
    await (consumer as any).connect();
    const handler = mockChannel.consume.mock.calls[0][1];

    const msg = {
      content: Buffer.from(JSON.stringify({ kind: 'test' })),
      fields: { routingKey: 'test.event' },
    };
    handler(msg);

    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('nacks (no requeue) unparseable messages', async () => {
    await (consumer as any).connect();
    const handler = mockChannel.consume.mock.calls[0][1];

    const msg = {
      content: Buffer.from('not-json{'),
      fields: { routingKey: 'bad' },
    };
    handler(msg);

    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
  });

  it('ignores null message from consume callback', async () => {
    await (consumer as any).connect();
    const handler = mockChannel.consume.mock.calls[0][1];
    expect(() => handler(null)).not.toThrow();
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('closes channel + connection on module destroy', async () => {
    await (consumer as any).connect();
    await consumer.onModuleDestroy();
    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });

  it('nack-path tolerates non-Error throws (err?.message ?? err fallback)', async () => {
    await (consumer as any).connect();
    const handler = mockChannel.consume.mock.calls[0][1];

    // Force JSON.parse to blow up with a non-Error value to exercise the
    // `err?.message ?? err` fallback inside the consume callback's catch.
    const spy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain-string-error';
    });
    try {
      expect(() =>
        handler({
          content: Buffer.from('{}'),
          fields: { routingKey: 'x' },
        }),
      ).not.toThrow();
      expect(mockChannel.nack).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('onModuleInit kicks off the connect handshake (fire-and-forget)', async () => {
    await consumer.onModuleInit();
    // onModuleInit does not await connect(); let the scheduled microtask
    // resolve before asserting.
    await new Promise((r) => setImmediate(r));
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy swallows channel.close + connection.close errors', async () => {
    await (consumer as any).connect();
    mockChannel.close.mockRejectedValueOnce(new Error('chan-close-fail'));
    mockConnection.close.mockRejectedValueOnce(new Error('conn-close-fail'));
    await expect(consumer.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('registers the "error" listener and survives both Error and non-Error payloads', async () => {
    await (consumer as any).connect();
    const errorHandler = mockConnection.on.mock.calls.find(
      ([ev]: [string]) => ev === 'error',
    )[1];
    expect(typeof errorHandler).toBe('function');
    expect(() => errorHandler(new Error('upstream-blew-up'))).not.toThrow();
    // Branch: error without a .message field falls back to the err itself.
    expect(() => errorHandler('plain-string-error')).not.toThrow();
  });

  it('reconnects on "close" event when not destroyed', async () => {
    jest.useFakeTimers();
    try {
      await (consumer as any).connect();
      const closeHandler = mockConnection.on.mock.calls.find(
        ([ev]: [string]) => ev === 'close',
      )[1];

      closeHandler();
      expect((consumer as any).channel).toBeNull();
      expect((consumer as any).connection).toBeNull();

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
    jest.useFakeTimers();
    try {
      await (consumer as any).connect();
      const closeHandler = mockConnection.on.mock.calls.find(
        ([ev]: [string]) => ev === 'close',
      )[1];

      (consumer as any).destroyed = true;
      (amqplib.connect as jest.Mock).mockClear();
      closeHandler();

      // No retry should be scheduled when destroyed=true.
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

      await (consumer as any).connect();
      expect((consumer as any).channel).toBeNull();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
      expect(amqplib.connect).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('handles non-Error rejection values in connect() catch path', async () => {
    (amqplib.connect as jest.Mock).mockRejectedValueOnce('plain-string-error');
    (consumer as any).destroyed = true; // skip retry timer
    await expect((consumer as any).connect()).resolves.toBeUndefined();
    expect((consumer as any).channel).toBeNull();
  });

  it('connect() is reentrancy-safe (no double-connect while already connected)', async () => {
    await (consumer as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    // Second call must early-return because channel is set.
    await (consumer as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    // And once destroyed, connect() is a no-op too.
    (consumer as any).destroyed = true;
    (consumer as any).channel = null;
    await (consumer as any).connect();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
  });
});
