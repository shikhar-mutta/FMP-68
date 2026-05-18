jest.mock('socket.io-client', () => ({ io: jest.fn() }));

const createSocket = (connected = true) => {
  const listeners = {};
  return {
    connected,
    id: 'socket-1',
    on: jest.fn((event, callback) => {
      listeners[event] = callback;
    }),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    _trigger: (event, ...args) => {
      if (listeners[event]) {
        listeners[event](...args);
      }
    },
    _getListeners: () => listeners,
  };
};

const loadService = (socket) => {
  const { io } = require('socket.io-client');
  io.mockReturnValue(socket);
  const service = require('../../services/socketService');
  return { io, ...service };
};

describe('socketService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REACT_APP_API_URL = 'http://api.test';
  });

  it('connects once and reuses connected socket', () => {
    const socket = createSocket(true);
    const { io, connectSocket } = loadService(socket);

    const first = connectSocket();
    const second = connectSocket();

    expect(io).toHaveBeenCalledWith('http://api.test/tracking', {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      autoConnect: true,
    });
    expect(first).toBe(socket);
    expect(second).toBe(socket);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('fires connect event and logs to console', () => {
    const socket = createSocket(true);
    const { connectSocket } = loadService(socket);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    connectSocket();

    socket._trigger('connect');

    expect(consoleSpy).toHaveBeenCalledWith('🔌 Socket connected:', 'socket-1');
    consoleSpy.mockRestore();
  });

  it('fires disconnect event and logs to console', () => {
    const socket = createSocket(true);
    const { connectSocket } = loadService(socket);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    connectSocket();

    socket._trigger('disconnect', 'transport close');

    expect(consoleSpy).toHaveBeenCalledWith('🔌 Socket disconnected:', 'transport close');
    consoleSpy.mockRestore();
  });

  it('fires connect_error event and logs to console', () => {
    const socket = createSocket(true);
    const { connectSocket } = loadService(socket);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    connectSocket();

    socket._trigger('connect_error', new Error('Connection refused'));

    expect(errorSpy).toHaveBeenCalledWith('🔌 Socket connection error:', 'Connection refused');
    errorSpy.mockRestore();
  });

  it('reconnects when socket missing or disconnected', () => {
    const socket = createSocket(false);
    const { io, getSocket } = loadService(socket);

    const result = getSocket();

    expect(result).toBe(socket);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('disconnects and clears socket instance', () => {
    const socket = createSocket(true);
    const { connectSocket, disconnectSocket, getSocket } = loadService(socket);

    connectSocket();
    disconnectSocket();
    expect(socket.disconnect).toHaveBeenCalled();

    const freshSocket = createSocket(true);
    const { io } = require('socket.io-client');
    io.mockReturnValue(freshSocket);

    const result = getSocket();

    expect(result).toBe(freshSocket);
  });

  it('emits tracking events with acknowledgements', async () => {
    const socket = createSocket(true);
    socket.emit.mockImplementation((event, payload, callback) => {
      if (typeof callback === 'function') {
        callback({ ok: true, event, payload });
      }
    });

    const {
      startTracking,
      pauseTracking,
      resumeTracking,
      endTracking,
      joinTracking,
      leaveTracking,
    } = loadService(socket);

    await expect(startTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'start-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
    await expect(pauseTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'pause-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
    await expect(resumeTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'resume-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
    await expect(endTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'end-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
    await expect(joinTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'join-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
    await expect(leaveTracking('path-1', 'user-1')).resolves.toEqual({
      ok: true,
      event: 'leave-tracking',
      payload: { pathId: 'path-1', userId: 'user-1' },
    });
  });

  it('emits location updates without acknowledgement', () => {
    const socket = createSocket(true);
    const { sendLocation } = loadService(socket);

    sendLocation('path-2', 'user-2', { lat: 1 }, 'publisher');

    expect(socket.emit).toHaveBeenCalledWith('send-location', {
      pathId: 'path-2',
      userId: 'user-2',
      coordinate: { lat: 1 },
      role: 'publisher',
    });
  });

  it('registers and unregisters socket listeners', () => {
    const socket = createSocket(true);
    const {
      onLocationUpdate,
      onTrackingStarted,
      onTrackingPaused,
      onTrackingResumed,
      onTrackingEnded,
      onFollowerJoined,
      onFollowerLeft,
    } = loadService(socket);

    const callback = jest.fn();

    const unsubs = [
      onLocationUpdate(callback),
      onTrackingStarted(callback),
      onTrackingPaused(callback),
      onTrackingResumed(callback),
      onTrackingEnded(callback),
      onFollowerJoined(callback),
      onFollowerLeft(callback),
    ];

    expect(socket.on).toHaveBeenCalledWith('location-update', callback);
    expect(socket.on).toHaveBeenCalledWith('tracking-started', callback);
    expect(socket.on).toHaveBeenCalledWith('tracking-paused', callback);
    expect(socket.on).toHaveBeenCalledWith('tracking-resumed', callback);
    expect(socket.on).toHaveBeenCalledWith('tracking-ended', callback);
    expect(socket.on).toHaveBeenCalledWith('follower-joined', callback);
    expect(socket.on).toHaveBeenCalledWith('follower-left', callback);

    unsubs.forEach((unsubscribe) => unsubscribe());

    expect(socket.off).toHaveBeenCalledWith('location-update', callback);
    expect(socket.off).toHaveBeenCalledWith('tracking-started', callback);
    expect(socket.off).toHaveBeenCalledWith('tracking-paused', callback);
    expect(socket.off).toHaveBeenCalledWith('tracking-resumed', callback);
    expect(socket.off).toHaveBeenCalledWith('tracking-ended', callback);
    expect(socket.off).toHaveBeenCalledWith('follower-joined', callback);
    expect(socket.off).toHaveBeenCalledWith('follower-left', callback);
  });

  it('startTracking rejects when the server returns success=false', async () => {
    const socket = createSocket(true);
    socket.emit.mockImplementation((event, payload, callback) => {
      callback({ success: false, message: 'already started' });
    });
    const { startTracking } = loadService(socket);
    await expect(startTracking('p1', 'u1')).rejects.toThrow('already started');
  });

  it('startTracking falls back to a generic message when none is provided', async () => {
    const socket = createSocket(true);
    socket.emit.mockImplementation((event, payload, callback) => {
      callback({ success: false });
    });
    const { startTracking } = loadService(socket);
    await expect(startTracking('p1', 'u1')).rejects.toThrow(
      'Failed to start tracking',
    );
  });

  it('startTracking times out after 8s when no callback fires', async () => {
    jest.useFakeTimers();
    try {
      const socket = createSocket(true);
      socket.emit.mockImplementation(() => {});
      const { startTracking } = loadService(socket);
      const promise = startTracking('p1', 'u1');
      jest.advanceTimersByTime(8001);
      await expect(promise).rejects.toThrow('start-tracking timed out');
    } finally {
      jest.useRealTimers();
    }
  });

  it('joinTracking rejects with a connect error after the 8s timeout', async () => {
    jest.useFakeTimers();
    try {
      const socket = createSocket(true);
      socket.emit.mockImplementation(() => {});
      const { joinTracking } = loadService(socket);
      const promise = joinTracking('p1', 'u1');
      jest.advanceTimersByTime(8001);
      await expect(promise).rejects.toThrow(
        'Could not connect to tracking server',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('republishTrack resolves with the server ack response', async () => {
    const socket = createSocket(true);
    socket.emit.mockImplementation((event, payload, callback) => {
      callback({ ok: true });
    });
    const { republishTrack } = loadService(socket);
    await expect(republishTrack('p1', 'u1')).resolves.toEqual({ ok: true });
  });

  it('republishTrack times out after 8s when no ack arrives', async () => {
    jest.useFakeTimers();
    try {
      const socket = createSocket(true);
      socket.emit.mockImplementation(() => {});
      const { republishTrack } = loadService(socket);
      const promise = republishTrack('p1', 'u1');
      jest.advanceTimersByTime(8001);
      await expect(promise).rejects.toThrow('republish-track timed out');
    } finally {
      jest.useRealTimers();
    }
  });

  it('onTrackingRepublished subscribes and returns an unsubscribe', () => {
    const socket = createSocket(true);
    const { onTrackingRepublished } = loadService(socket);
    const cb = jest.fn();
    const off = onTrackingRepublished(cb);
    expect(socket.on).toHaveBeenCalledWith('tracking-republished', cb);
    off();
    expect(socket.off).toHaveBeenCalledWith('tracking-republished', cb);
  });
});
