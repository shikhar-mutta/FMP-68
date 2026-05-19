import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

// ── from tracking.service.spec.ts ──
type PrismaMock = {
  path: { update: jest.Mock; findUnique: jest.Mock };
  trackingSession: {
    create: jest.Mock;
    updateMany: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

const makePrisma = (): PrismaMock => ({
  path: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  trackingSession: {
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
});

describe('TrackingService', () => {
  let prisma: PrismaMock;
  let service: TrackingService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TrackingService(prisma as any);
  });

  describe('startTracking', () => {
    it('puts the path into recording state with empty coordinates', async () => {
      await service.startTracking('p1', 'u1');
      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'recording', isLive: true, coordinates: [] },
      });
    });

    it('opens a publisher tracking session', async () => {
      await service.startTracking('p1', 'u1');
      expect(prisma.trackingSession.create).toHaveBeenCalledWith({
        data: {
          pathId: 'p1',
          userId: 'u1',
          role: 'publisher',
          coordinates: [],
          isActive: true,
        },
      });
    });
  });

  describe('recordLocation', () => {
    const coord = { lat: 1, lng: 2 } as any;

    it('pushes the coordinate to both path and publisher session for publisher role', async () => {
      await service.recordLocation({
        pathId: 'p1',
        userId: 'u1',
        coordinate: coord,
        role: 'publisher',
      });

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { coordinates: { push: coord } },
      });
      expect(prisma.trackingSession.updateMany).toHaveBeenCalledWith({
        where: { pathId: 'p1', userId: 'u1', role: 'publisher', isActive: true },
        data: { coordinates: { push: coord } },
      });
    });

    it('only updates the follower session for follower role (no path mutation)', async () => {
      await service.recordLocation({
        pathId: 'p1',
        userId: 'u2',
        coordinate: coord,
        role: 'follower',
      });

      expect(prisma.path.update).not.toHaveBeenCalled();
      expect(prisma.trackingSession.updateMany).toHaveBeenCalledWith({
        where: { pathId: 'p1', userId: 'u2', role: 'follower', isActive: true },
        data: { coordinates: { push: coord } },
      });
    });
  });

  describe('pauseTracking / resumeTracking', () => {
    it('pauseTracking sets status=paused', async () => {
      await service.pauseTracking('p1');
      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'paused' },
      });
    });

    it('resumeTracking returns to recording and isLive=true', async () => {
      await service.resumeTracking('p1');
      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'recording', isLive: true },
      });
    });
  });

  describe('endTracking', () => {
    it('marks the path ended and closes all active sessions', async () => {
      await service.endTracking('p1');
      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'ended', isLive: false },
      });
      const closeCall = prisma.trackingSession.updateMany.mock.calls[0][0];
      expect(closeCall.where).toEqual({ pathId: 'p1', isActive: true });
      expect(closeCall.data.isActive).toBe(false);
      expect(closeCall.data.endedAt).toBeInstanceOf(Date);
    });
  });

  describe('joinTracking', () => {
    it('creates a follower session when none exists', async () => {
      prisma.trackingSession.findFirst.mockResolvedValue(null);
      await service.joinTracking('p1', 'u2');
      expect(prisma.trackingSession.create).toHaveBeenCalledWith({
        data: {
          pathId: 'p1',
          userId: 'u2',
          role: 'follower',
          coordinates: [],
          isActive: true,
        },
      });
    });

    it('does not create a duplicate session when one already exists', async () => {
      prisma.trackingSession.findFirst.mockResolvedValue({ id: 's1' });
      await service.joinTracking('p1', 'u2');
      expect(prisma.trackingSession.create).not.toHaveBeenCalled();
    });

    it('returns the path after joining', async () => {
      const path = { id: 'p1' };
      prisma.path.findUnique.mockResolvedValue(path);
      await expect(service.joinTracking('p1', 'u2')).resolves.toBe(path);
    });
  });

  describe('leaveTracking', () => {
    it('closes the follower session for the given user', async () => {
      await service.leaveTracking('p1', 'u2');
      const call = prisma.trackingSession.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({
        pathId: 'p1',
        userId: 'u2',
        role: 'follower',
        isActive: true,
      });
      expect(call.data.isActive).toBe(false);
      expect(call.data.endedAt).toBeInstanceOf(Date);
    });
  });

  describe('getTrackingData', () => {
    it('returns path and active sessions in parallel', async () => {
      const path = { id: 'p1', publisher: { id: 'u1' } };
      const sessions = [{ id: 's1' }, { id: 's2' }];
      prisma.path.findUnique.mockResolvedValue(path);
      prisma.trackingSession.findMany.mockResolvedValue(sessions);

      const result = await service.getTrackingData('p1');

      expect(result).toEqual({ path, sessions });
      expect(prisma.trackingSession.findMany).toHaveBeenCalledWith({
        where: { pathId: 'p1', isActive: true },
      });
    });
  });

  describe('republishTrack', () => {
    it('resets the path to idle and closes all active sessions', async () => {
      await service.republishTrack('p1');
      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'idle', isLive: false, coordinates: [] },
      });
      const closeCall = prisma.trackingSession.updateMany.mock.calls[0][0];
      expect(closeCall.where).toEqual({ pathId: 'p1', isActive: true });
      expect(closeCall.data.isActive).toBe(false);
      expect(closeCall.data.endedAt).toBeInstanceOf(Date);
    });
  });
});

// ── from tracking.gateway.spec.ts ──
type ServerMock = { to: jest.Mock; emit?: jest.Mock };

const makeServer = (): ServerMock => {
  const emitter = { emit: jest.fn() };
  return { to: jest.fn().mockReturnValue(emitter) };
};

const makeClient = () => {
  const client: any = {
    id: 'client-1',
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  return client;
};

describe('TrackingGateway', () => {
  let trackingService: any;
  let gateway: TrackingGateway;
  let server: ServerMock;

  beforeEach(() => {
    trackingService = {
      startTracking: jest.fn().mockResolvedValue(undefined),
      recordLocation: jest.fn().mockResolvedValue(undefined),
      pauseTracking: jest.fn().mockResolvedValue(undefined),
      resumeTracking: jest.fn().mockResolvedValue(undefined),
      endTracking: jest.fn().mockResolvedValue(undefined),
      republishTrack: jest.fn().mockResolvedValue(undefined),
      joinTracking: jest.fn().mockResolvedValue({
        coordinates: [{ lat: 1, lng: 2 }],
        status: 'recording',
      }),
      leaveTracking: jest.fn().mockResolvedValue(undefined),
      getTrackingData: jest
        .fn()
        .mockResolvedValue({ path: { id: 'p1' }, sessions: [] }),
    };
    const trailCache: any = {
      appendCoord: jest.fn().mockResolvedValue(undefined),
      getRecentTrail: jest.fn().mockResolvedValue([]),
      clearTrail: jest.fn(),
    };
    gateway = new TrackingGateway(trackingService, trailCache);
    server = makeServer();
    (gateway as any).server = server;
  });

  describe('connection lifecycle', () => {
    it('handleConnection logs but does not throw', () => {
      const client = makeClient();
      expect(() => gateway.handleConnection(client)).not.toThrow();
    });

    it('handleDisconnect leaves all rooms the client joined', async () => {
      const client = makeClient();
      await gateway.handleStartTracking(client, { pathId: 'p1', userId: 'u1' });
      await gateway.handleJoinTracking(client, { pathId: 'p2', userId: 'u1' });

      gateway.handleDisconnect(client);

      expect(client.leave).toHaveBeenCalledWith('path-p1');
      expect(client.leave).toHaveBeenCalledWith('path-p2');
    });

    it('handleDisconnect is a no-op for unknown clients', () => {
      const client = makeClient();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  describe('handleStartTracking', () => {
    it('starts tracking, joins the path room, and broadcasts', async () => {
      const client = makeClient();
      const result = await gateway.handleStartTracking(client, {
        pathId: 'p1',
        userId: 'u1',
      });
      expect(trackingService.startTracking).toHaveBeenCalledWith('p1', 'u1');
      expect(client.join).toHaveBeenCalledWith('path-p1');
      expect(server.to).toHaveBeenCalledWith('path-p1');
      expect(result).toEqual({ success: true, message: 'Tracking started' });
    });

    it('returns success=false when the service throws', async () => {
      trackingService.startTracking.mockRejectedValue(new Error('db down'));
      const client = makeClient();
      const result = await gateway.handleStartTracking(client, {
        pathId: 'p1',
        userId: 'u1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handleSendLocation', () => {
    it('records the location and broadcasts to the room (excluding sender)', async () => {
      const client = makeClient();
      const payload = {
        pathId: 'p1',
        userId: 'u1',
        coordinate: { lat: 1, lng: 2, timestamp: 0 },
        role: 'publisher',
      };
      const result = await gateway.handleSendLocation(client, payload as any);
      expect(trackingService.recordLocation).toHaveBeenCalledWith(payload);
      expect(client.to).toHaveBeenCalledWith('path-p1');
      expect(result.success).toBe(true);
    });

    it('returns success=false when recordLocation throws', async () => {
      trackingService.recordLocation.mockRejectedValue(new Error('boom'));
      const client = makeClient();
      const result = await gateway.handleSendLocation(client, {
        pathId: 'p1',
        userId: 'u1',
        coordinate: { lat: 0, lng: 0, timestamp: 0 },
        role: 'publisher',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pause/resume/end', () => {
    const data = { pathId: 'p1', userId: 'u1' };

    it('handlePauseTracking pauses and broadcasts', async () => {
      const result = await gateway.handlePauseTracking(makeClient(), data);
      expect(trackingService.pauseTracking).toHaveBeenCalledWith('p1');
      expect(server.to).toHaveBeenCalledWith('path-p1');
      expect(result.success).toBe(true);
    });

    it('handlePauseTracking returns failure when service throws', async () => {
      trackingService.pauseTracking.mockRejectedValue(new Error('x'));
      const result = await gateway.handlePauseTracking(makeClient(), data);
      expect(result.success).toBe(false);
    });

    it('handleResumeTracking resumes and broadcasts', async () => {
      const result = await gateway.handleResumeTracking(makeClient(), data);
      expect(trackingService.resumeTracking).toHaveBeenCalledWith('p1');
      expect(result.success).toBe(true);
    });

    it('handleResumeTracking returns failure when service throws', async () => {
      trackingService.resumeTracking.mockRejectedValue(new Error('x'));
      const result = await gateway.handleResumeTracking(makeClient(), data);
      expect(result.success).toBe(false);
    });

    it('handleEndTracking ends and broadcasts', async () => {
      const result = await gateway.handleEndTracking(makeClient(), data);
      expect(trackingService.endTracking).toHaveBeenCalledWith('p1');
      expect(result.success).toBe(true);
    });

    it('handleEndTracking returns failure when service throws', async () => {
      trackingService.endTracking.mockRejectedValue(new Error('x'));
      const result = await gateway.handleEndTracking(makeClient(), data);
      expect(result.success).toBe(false);
    });
  });

  describe('join/leave', () => {
    it('handleJoinTracking joins the room and returns publisher coords + status', async () => {
      const client = makeClient();
      const result = await gateway.handleJoinTracking(client, {
        pathId: 'p1',
        userId: 'u2',
      });
      expect(trackingService.joinTracking).toHaveBeenCalledWith('p1', 'u2');
      expect(client.join).toHaveBeenCalledWith('path-p1');
      expect(result.success).toBe(true);
      expect((result as any).publisherCoordinates).toEqual([{ lat: 1, lng: 2 }]);
      expect((result as any).pathStatus).toBe('recording');
    });

    it('handleJoinTracking falls back to defaults when path is null', async () => {
      trackingService.joinTracking.mockResolvedValue(null);
      const result = await gateway.handleJoinTracking(makeClient(), {
        pathId: 'p1',
        userId: 'u2',
      });
      expect((result as any).publisherCoordinates).toEqual([]);
      expect((result as any).pathStatus).toBe('idle');
    });

    it('handleJoinTracking prefers the cached trail (reversed) when non-empty', async () => {
      // Cache returns newest-first; the gateway must reverse to oldest-first.
      const newestFirst = [
        { lat: 3, lng: 3, timestamp: 3 },
        { lat: 2, lng: 2, timestamp: 2 },
        { lat: 1, lng: 1, timestamp: 1 },
      ];
      const trailCache = (gateway as any).trailCache;
      trailCache.getRecentTrail.mockResolvedValue(newestFirst);

      const result = await gateway.handleJoinTracking(makeClient(), {
        pathId: 'p1',
        userId: 'u2',
      });

      expect((result as any).publisherCoordinates).toEqual([
        { lat: 1, lng: 1, timestamp: 1 },
        { lat: 2, lng: 2, timestamp: 2 },
        { lat: 3, lng: 3, timestamp: 3 },
      ]);
    });

    it('handleJoinTracking returns failure on service error', async () => {
      trackingService.joinTracking.mockRejectedValue(new Error('x'));
      const result = await gateway.handleJoinTracking(makeClient(), {
        pathId: 'p1',
        userId: 'u2',
      });
      expect(result.success).toBe(false);
    });

    it('handleLeaveTracking leaves the room and notifies others', async () => {
      const client = makeClient();
      const result = await gateway.handleLeaveTracking(client, {
        pathId: 'p1',
        userId: 'u2',
      });
      expect(client.leave).toHaveBeenCalledWith('path-p1');
      expect(trackingService.leaveTracking).toHaveBeenCalledWith('p1', 'u2');
      expect(result.success).toBe(true);
    });

    it('handleLeaveTracking returns failure on service error', async () => {
      trackingService.leaveTracking.mockRejectedValue(new Error('x'));
      const result = await gateway.handleLeaveTracking(makeClient(), {
        pathId: 'p1',
        userId: 'u2',
      });
      expect(result.success).toBe(false);
    });

    it('handleLeaveTracking removes the room from userRooms when client was previously tracked', async () => {
      const client = makeClient();
      // First join so the room is recorded in userRooms
      await gateway.handleJoinTracking(client, { pathId: 'p3', userId: 'u2' });
      // Now leave — removeRoom is called with rooms that exist for this client
      const result = await gateway.handleLeaveTracking(client, {
        pathId: 'p3',
        userId: 'u2',
      });
      expect(client.leave).toHaveBeenCalledWith('path-p3');
      expect(result.success).toBe(true);
    });
  });

  describe('handleGetTrackingData', () => {
    it('returns the snapshot from the service', async () => {
      const result = await gateway.handleGetTrackingData(makeClient(), {
        pathId: 'p1',
      });
      expect(result.success).toBe(true);
      expect((result as any).path).toEqual({ id: 'p1' });
      expect((result as any).sessions).toEqual([]);
    });

    it('returns failure on service error', async () => {
      trackingService.getTrackingData.mockRejectedValue(new Error('x'));
      const result = await gateway.handleGetTrackingData(makeClient(), {
        pathId: 'p1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handleRepublishTrack', () => {
    const data = { pathId: 'p1', userId: 'u1' };

    it('republishes the track, clears the cache, joins the room, and broadcasts', async () => {
      const client = makeClient();
      const trailCache = (gateway as any).trailCache;
      const result = await gateway.handleRepublishTrack(client, data);

      expect(trackingService.republishTrack).toHaveBeenCalledWith('p1');
      expect(trailCache.clearTrail).toHaveBeenCalledWith('p1');
      expect(client.join).toHaveBeenCalledWith('path-p1');
      expect(server.to).toHaveBeenCalledWith('path-p1');
      expect(result.success).toBe(true);
    });

    it('returns failure when the service throws', async () => {
      trackingService.republishTrack.mockRejectedValue(new Error('db-down'));
      const result = await gateway.handleRepublishTrack(makeClient(), data);
      expect(result.success).toBe(false);
    });
  });
});
