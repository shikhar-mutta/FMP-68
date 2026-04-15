import { Test, TestingModule } from '@nestjs/testing';
import { TrackingGateway } from './tracking.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { Socket, Server } from 'socket.io';

describe('TrackingGateway', () => {
  let gateway: TrackingGateway;
  let prisma: PrismaService;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        {
          provide: PrismaService,
          useValue: {
            path: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            trackingSession: {
              create: jest.fn(),
              updateMany: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
    prisma = module.get<PrismaService>(PrismaService);
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log when client connects', () => {
      const spy = jest.spyOn(gateway['logger'], 'log');
      gateway.handleConnection(mockSocket as any);
      expect(spy).toHaveBeenCalledWith('Client connected: socket-123');
    });
  });

  describe('handleDisconnect', () => {
    it('should log when client disconnects', () => {
      const spy = jest.spyOn(gateway['logger'], 'log');
      gateway.handleDisconnect(mockSocket as any);
      expect(spy).toHaveBeenCalledWith('Client disconnected: socket-123');
    });

    it('should clean up rooms on disconnect', () => {
      gateway['userRooms'].set('socket-123', new Set(['path-123', 'path-456']));
      gateway.handleDisconnect(mockSocket as any);
      expect(gateway['userRooms'].has('socket-123')).toBe(false);
    });
  });

  describe('handleStartTracking', () => {
    it('should start tracking successfully', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.trackingSession, 'create').mockResolvedValue({} as any);

      const result = await gateway.handleStartTracking(mockSocket as any, data);

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'path-123' },
        data: { status: 'recording', isLive: true, coordinates: [] },
      });
      expect(prisma.trackingSession.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle tracking start error', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockRejectedValue(new Error('DB error'));

      const result = await gateway.handleStartTracking(mockSocket as any, data);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to start tracking');
    });
  });

  describe('handleSendLocation', () => {
    it('should send location for publisher', async () => {
      const data = {
        pathId: 'path-123',
        userId: 'user-123',
        coordinate: { lat: 40.7128, lng: -74.006, timestamp: Date.now() },
        role: 'publisher',
      };

      jest.spyOn(prisma.path, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.trackingSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const result = await gateway.handleSendLocation(mockSocket as any, data);

      expect(result.success).toBe(true);
    });

    it('should send location for follower', async () => {
      const data = {
        pathId: 'path-123',
        userId: 'follower-456',
        coordinate: { lat: 40.7128, lng: -74.006, timestamp: Date.now() },
        role: 'follower',
      };

      jest.spyOn(prisma.trackingSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const result = await gateway.handleSendLocation(mockSocket as any, data);

      expect(result.success).toBe(true);
    });

    it('should handle send location error', async () => {
      const data = {
        pathId: 'path-123',
        userId: 'user-123',
        coordinate: { lat: 40.7128, lng: -74.006, timestamp: Date.now() },
        role: 'publisher',
      };

      jest.spyOn(prisma.path, 'update').mockRejectedValue(new Error('Error'));

      const result = await gateway.handleSendLocation(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('handlePauseTracking', () => {
    it('should pause tracking', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockResolvedValue({} as any);

      const result = await gateway.handlePauseTracking(mockSocket as any, data);

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'path-123' },
        data: { status: 'paused' },
      });
      expect(result.success).toBe(true);
    });

    it('should handle pause error', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockRejectedValue(new Error('Error'));

      const result = await gateway.handlePauseTracking(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('handleResumeTracking', () => {
    it('should resume tracking', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockResolvedValue({} as any);

      const result = await gateway.handleResumeTracking(mockSocket as any, data);

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'path-123' },
        data: { status: 'recording', isLive: true },
      });
      expect(result.success).toBe(true);
    });

    it('should handle resume error', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockRejectedValue(new Error('Error'));

      const result = await gateway.handleResumeTracking(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('handleEndTracking', () => {
    it('should end tracking', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.trackingSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const result = await gateway.handleEndTracking(mockSocket as any, data);

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: 'path-123' },
        data: { status: 'ended', isLive: false },
      });
      expect(result.success).toBe(true);
    });

    it('should handle end tracking error', async () => {
      const data = { pathId: 'path-123', userId: 'user-123' };

      jest.spyOn(prisma.path, 'update').mockRejectedValue(new Error('Error'));

      const result = await gateway.handleEndTracking(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('handleJoinTracking', () => {
    it('should allow follower to join tracking', async () => {
      const data = { pathId: 'path-123', userId: 'follower-456' };

      jest.spyOn(prisma.trackingSession, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.trackingSession, 'create').mockResolvedValue({} as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        id: 'path-123',
        coordinates: [[1, 2], [3, 4]],
        status: 'recording',
      } as any);

      const result = await gateway.handleJoinTracking(mockSocket as any, data);

      expect(mockSocket.join).toHaveBeenCalledWith('path-path-123');
      expect(result.success).toBe(true);
    });

    it('should not create duplicate tracking session', async () => {
      const data = { pathId: 'path-123', userId: 'follower-456' };

      jest.spyOn(prisma.trackingSession, 'findFirst').mockResolvedValue({} as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        id: 'path-123',
        coordinates: [],
        status: 'recording',
      } as any);

      const result = await gateway.handleJoinTracking(mockSocket as any, data);

      expect(prisma.trackingSession.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle join error', async () => {
      const data = { pathId: 'path-123', userId: 'follower-456' };

      jest.spyOn(prisma.trackingSession, 'findFirst').mockRejectedValue(new Error('Error'));

      const result = await gateway.handleJoinTracking(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('handleLeaveTracking', () => {
    it('should remove follower from tracking', async () => {
      const data = { pathId: 'path-123', userId: 'follower-456' };
      gateway['addRoom']('socket-123', 'path-path-123');

      jest.spyOn(prisma.trackingSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const result = await gateway.handleLeaveTracking(mockSocket as any, data);

      expect(mockSocket.leave).toHaveBeenCalledWith('path-path-123');
      expect(result.success).toBe(true);
    });

    it('should handle leave error', async () => {
      const data = { pathId: 'path-123', userId: 'follower-456' };

      jest.spyOn(prisma.trackingSession, 'updateMany').mockResolvedValue({ count: 0 } as any);

      const result = await gateway.handleLeaveTracking(mockSocket as any, data);

      expect(result.success).toBe(true);
    });
  });

  describe('handleGetTrackingData', () => {
    it('should get tracking data', async () => {
      const data = { pathId: 'path-123' };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        id: 'path-123',
        coordinates: [[1, 2]],
        status: 'recording',
        publisher: {},
      } as any);
      jest.spyOn(prisma.trackingSession, 'findMany').mockResolvedValue([]);

      const result = await gateway.handleGetTrackingData(mockSocket as any, data);

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
    });

    it('should handle get tracking data error', async () => {
      const data = { pathId: 'path-123' };

      jest.spyOn(prisma.path, 'findUnique').mockRejectedValue(new Error('Error'));

      const result = await gateway.handleGetTrackingData(mockSocket as any, data);

      expect(result.success).toBe(false);
    });
  });

  describe('addRoom', () => {
    it('should add room for socket', () => {
      gateway['addRoom']('socket-123', 'path-123');
      expect(gateway['userRooms'].get('socket-123')).toContain('path-123');
    });

    it('should create new set if socket not in map', () => {
      expect(gateway['userRooms'].has('socket-999')).toBe(false);
      gateway['addRoom']('socket-999', 'path-456');
      expect(gateway['userRooms'].has('socket-999')).toBe(true);
    });

    it('should handle adding multiple rooms', () => {
      gateway['addRoom']('socket-123', 'path-1');
      gateway['addRoom']('socket-123', 'path-2');
      const rooms = gateway['userRooms'].get('socket-123');
      expect(rooms?.size).toBe(2);
      expect(rooms).toContain('path-1');
      expect(rooms).toContain('path-2');
    });

    it('should not add duplicate room', () => {
      gateway['addRoom']('socket-123', 'path-123');
      gateway['addRoom']('socket-123', 'path-123');
      expect(gateway['userRooms'].get('socket-123')?.size).toBe(1);
    });
  });

  describe('removeRoom', () => {
    it('should remove room from socket', () => {
      gateway['addRoom']('socket-123', 'path-123');
      gateway['removeRoom']('socket-123', 'path-123');
      expect(gateway['userRooms'].get('socket-123')).not.toContain('path-123');
    });

    it('should handle removing non-existent room', () => {
      gateway['addRoom']('socket-123', 'path-123');
      gateway['removeRoom']('socket-123', 'path-456');
      expect(gateway['userRooms'].get('socket-123')).toContain('path-123');
    });

    it('should clean up empty room sets', () => {
      gateway['addRoom']('socket-123', 'path-123');
      gateway['removeRoom']('socket-123', 'path-123');
      expect(gateway['userRooms'].get('socket-123')?.size).toBe(0);
    });
  });

  describe('room management', () => {
    it('should maintain separate room lists per socket', () => {
      gateway['addRoom']('socket-1', 'path-1');
      gateway['addRoom']('socket-2', 'path-2');

      expect(gateway['userRooms'].get('socket-1')).toContain('path-1');
      expect(gateway['userRooms'].get('socket-2')).toContain('path-2');
      expect(gateway['userRooms'].get('socket-1')).not.toContain('path-2');
    });

    it('should handle cleanup of all rooms', () => {
      gateway['addRoom']('socket-123', 'path-1');
      gateway['addRoom']('socket-123', 'path-2');
      gateway['addRoom']('socket-123', 'path-3');

      expect(gateway['userRooms'].get('socket-123')?.size).toBe(3);

      gateway['userRooms'].delete('socket-123');

      expect(gateway['userRooms'].has('socket-123')).toBe(false);
    });
  });
});
