import { Test, TestingModule } from '@nestjs/testing';
import { FollowRequestsService } from './follow-requests.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FollowRequestsService', () => {
  let service: FollowRequestsService;
  let prisma: PrismaService;

  const mockPublisher = {
    id: 'publisher-123',
    googleId: 'google-pub',
    email: 'publisher@example.com',
    name: 'Publisher',
    picture: 'https://example.com/pub.jpg',
    isOnline: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    followedPathIds: [],
  };

  const mockFollower = {
    id: 'follower-123',
    googleId: 'google-follower',
    email: 'follower@example.com',
    name: 'Follower',
    picture: 'https://example.com/follower.jpg',
    isOnline: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    followedPathIds: [],
  };

  const mockPath = {
    id: 'path-123',
    title: 'Morning Run',
    description: 'A 5km run',
    publisherId: mockPublisher.id,
    followerIds: [],
    followRequests: [],
    coordinates: [],
    status: 'idle',
    isLive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    publisher: mockPublisher,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowRequestsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            path: {
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FollowRequestsService>(FollowRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFollowRequest', () => {
    it('should create a follow request successfully', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(mockPath as any);
      jest.spyOn(prisma.path, 'update').mockResolvedValue({
        ...mockPath,
        followRequests: [mockFollower.id],
      } as any);

      const result = await service.createFollowRequest(mockFollower.id, createFollowRequestDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockFollower.id } });
      expect(result.message).toBe('Follow request created');
      expect(result.followerId).toBe(mockFollower.id);
    });

    it('should throw error if user not found', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.createFollowRequest('nonexistent', createFollowRequestDto),
      ).rejects.toThrow('User not found');
    });

    it('should throw error if path not found', async () => {
      const createFollowRequestDto = {
        pathId: 'nonexistent',
        publisherId: mockPublisher.id,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(
        service.createFollowRequest(mockFollower.id, createFollowRequestDto),
      ).rejects.toThrow('Path not found');
    });

    it('should throw error if publisher mismatch', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: 'wrong-publisher',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(mockPath as any);

      await expect(
        service.createFollowRequest(mockFollower.id, createFollowRequestDto),
      ).rejects.toThrow('Publisher does not own this path');
    });

    it('should throw error if follow request already pending', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      const pathWithPendingRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithPendingRequest as any);

      await expect(
        service.createFollowRequest(mockFollower.id, createFollowRequestDto),
      ).rejects.toThrow('Follow request already pending for this user');
    });

    it('should throw error if already following', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      const pathWithFollower = {
        ...mockPath,
        followerIds: [mockFollower.id],
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);

      await expect(
        service.createFollowRequest(mockFollower.id, createFollowRequestDto),
      ).rejects.toThrow('User is already following this path');
    });

    it('should handle null followRequests array', async () => {
      const createFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      const pathWithNullFollowRequests = {
        ...mockPath,
        followRequests: null,
        followerIds: null,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullFollowRequests as any);
      jest.spyOn(prisma.path, 'update').mockResolvedValue({
        ...mockPath,
        followRequests: [mockFollower.id],
      } as any);

      const result = await service.createFollowRequest(mockFollower.id, createFollowRequestDto);

      expect(result.message).toBe('Follow request created');
    });
  });

  describe('approveFollowRequest', () => {
    it('should approve a follow request successfully', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([
        { ...mockPath, followRequests: [], followerIds: [mockFollower.id] },
        mockFollower,
      ] as any);

      const result = await service.approveFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id);

      expect(prisma.path.findUnique).toHaveBeenCalledWith({ where: { id: mockPath.id } });
      expect(result.message).toBe('Follow request approved');
      expect(result.userId).toBe(mockFollower.id);
    });

    it('should approve request when user already in followerIds', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
        followerIds: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([
        { ...mockPath, followRequests: [], followerIds: [mockFollower.id] },
        mockFollower,
      ] as any);

      const result = await service.approveFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id);

      expect(result.message).toBe('Follow request approved');
    });

    it('should throw error if not authorized', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);

      await expect(
        service.approveFollowRequest(mockPath.id, mockFollower.id, 'wrong-publisher'),
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error if follow request not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        ...mockPath,
        followRequests: [],
      } as any);

      await expect(
        service.approveFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Follow request not found');
    });

    it('should throw error if path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(
        service.approveFollowRequest('nonexistent', mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Path not found');
    });

    it('should handle null followRequests and followerIds', async () => {
      const pathWithNullLists = {
        ...mockPath,
        followRequests: null,
        followerIds: null,
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullLists as any);

      await expect(
        service.approveFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Follow request not found');
    });
  });

  describe('rejectFollowRequest', () => {
    it('should reject a follow request successfully', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);
      jest.spyOn(prisma.path, 'update').mockResolvedValue({
        ...mockPath,
        followRequests: [],
      } as any);

      const result = await service.rejectFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id);

      expect(result.message).toBe('Follow request rejected');
      expect(result.userId).toBe(mockFollower.id);
    });

    it('should throw error if not authorized', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);

      await expect(
        service.rejectFollowRequest(mockPath.id, mockFollower.id, 'wrong-publisher'),
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error if follow request not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        ...mockPath,
        followRequests: [],
      } as any);

      await expect(
        service.rejectFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Follow request not found');
    });

    it('should throw error if path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(
        service.rejectFollowRequest('nonexistent', mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Path not found');
    });

    it('should handle null followRequests array', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        ...mockPath,
        followRequests: null,
      } as any);

      await expect(
        service.rejectFollowRequest(mockPath.id, mockFollower.id, mockPublisher.id),
      ).rejects.toThrow('Follow request not found');
    });
  });

  describe('cancelFollowRequest', () => {
    it('should cancel a follow request successfully', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);
      jest.spyOn(prisma.path, 'update').mockResolvedValue({
        ...mockPath,
        followRequests: [],
      } as any);

      const result = await service.cancelFollowRequest(mockPath.id, mockFollower.id);

      expect(result.message).toBe('Follow request cancelled');
      expect(result.userId).toBe(mockFollower.id);
    });

    it('should throw error if follow request not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue({
        ...mockPath,
        followRequests: [],
      } as any);

      await expect(
        service.cancelFollowRequest(mockPath.id, mockFollower.id),
      ).rejects.toThrow('Follow request not found');
    });

    it('should throw error if path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.cancelFollowRequest('nonexistent', mockFollower.id)).rejects.toThrow(
        'Path not found',
      );
    });

    it('should handle null followRequests array', async () => {
      const pathWithNullRequests = {
        ...mockPath,
        followRequests: null,
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullRequests as any);

      await expect(service.cancelFollowRequest(mockPath.id, mockFollower.id)).rejects.toThrow(
        'Follow request not found',
      );
    });
  });

  describe('getPendingFollowRequestsForPublisher', () => {
    it('should return all pending follow requests for publisher', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithRequest] as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockFollower] as any);

      const result = await service.getPendingFollowRequestsForPublisher(mockPublisher.id);

      expect(prisma.path.findMany).toHaveBeenCalledWith({
        where: { publisherId: mockPublisher.id },
        include: { publisher: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].followerId).toBe(mockFollower.id);
    });

    it('should return empty array when no pending requests', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([mockPath] as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.getPendingFollowRequestsForPublisher(mockPublisher.id);

      expect(result).toEqual([]);
    });

    it('should handle null followRequests arrays', async () => {
      const pathWithNullRequests = {
        ...mockPath,
        followRequests: null,
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithNullRequests] as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.getPendingFollowRequestsForPublisher(mockPublisher.id);

      expect(result).toEqual([]);
    });

    it('should return multiple pending requests', async () => {
      const anotherFollower = { ...mockFollower, id: 'follower-456' };
      const pathWithMultipleRequests = {
        ...mockPath,
        followRequests: [mockFollower.id, anotherFollower.id],
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithMultipleRequests] as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockFollower, anotherFollower] as any);

      const result = await service.getPendingFollowRequestsForPublisher(mockPublisher.id);

      expect(result).toHaveLength(2);
    });
  });

  describe('getFollowRequestsForPath', () => {
    it('should return follow requests for a specific path', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithRequest as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([mockFollower] as any);

      const result = await service.getFollowRequestsForPath(mockPath.id);

      expect(prisma.path.findUnique).toHaveBeenCalledWith({
        where: { id: mockPath.id },
        include: { publisher: true },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no follow requests', async () => {
      const pathWithoutRequests = {
        ...mockPath,
        followRequests: [],
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithoutRequests as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.getFollowRequestsForPath(mockPath.id);

      expect(result).toEqual([]);
    });

    it('should throw error if path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.getFollowRequestsForPath('nonexistent')).rejects.toThrow('Path not found');
    });

    it('should handle null followRequests array', async () => {
      const pathWithNullRequests = {
        ...mockPath,
        followRequests: null,
      };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullRequests as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

      const result = await service.getFollowRequestsForPath(mockPath.id);

      expect(result).toEqual([]);
    });
  });

  describe('getFollowRequestsSentByUser', () => {
    it('should return pending follow requests sent by user', async () => {
      const pathWithRequest = {
        ...mockPath,
        followRequests: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithRequest] as any);

      const result = await service.getFollowRequestsSentByUser(mockFollower.id);

      expect(result.some((r) => r.status === 'PENDING')).toBe(true);
    });

    it('should return approved follow requests', async () => {
      const pathWithFollower = {
        ...mockPath,
        followerIds: [mockFollower.id],
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithFollower] as any);

      const result = await service.getFollowRequestsSentByUser(mockFollower.id);

      expect(result.some((r) => r.status === 'APPROVED')).toBe(true);
    });

    it('should return empty array when user has no requests or follows', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([mockPath] as any);

      const result = await service.getFollowRequestsSentByUser('unknown-user');

      expect(result).toEqual([]);
    });

    it('should return both pending and approved requests', async () => {
      const path2 = { ...mockPath, id: 'path-456', followerIds: [mockFollower.id] };
      const paths = [
        { ...mockPath, followRequests: [mockFollower.id] },
        path2,
      ];

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue(paths as any);

      const result = await service.getFollowRequestsSentByUser(mockFollower.id);

      expect(result).toHaveLength(2);
      expect(result.filter((r) => r.status === 'PENDING')).toHaveLength(1);
      expect(result.filter((r) => r.status === 'APPROVED')).toHaveLength(1);
    });

    it('should handle null followRequests and followerIds', async () => {
      const pathWithNulls = {
        ...mockPath,
        followRequests: null,
        followerIds: null,
      };

      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithNulls] as any);

      const result = await service.getFollowRequestsSentByUser(mockFollower.id);

      expect(result).toEqual([]);
    });
  });
});
