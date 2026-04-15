import { Test, TestingModule } from '@nestjs/testing';
import { PathsService } from './paths.service';
import { PrismaService } from '../prisma/prisma.service';
import { describe } from 'node:test';

describe('PathsService', () => {
  let service: PathsService;
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

  const mockPath = {
    id: 'path-123',
    title: 'Morning Run',
    description: 'A 5km run in the park',
    publisherId: 'publisher-123',
    followerIds: [],
    followRequests: [],
    coordinates: [],
    status: 'idle',
    isLive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    publisher: mockPublisher,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathsService,
        {
          provide: PrismaService,
          useValue: {
            path: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PathsService>(PathsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPath', () => {
    it('should create a new path', async () => {
      const createPathDto = {
        title: 'Morning Run',
        description: 'A 5km run in the park',
      };

      jest.spyOn(prisma.path, 'create').mockResolvedValue(mockPath as any);

      const result = await service.createPath(mockPublisher.id, createPathDto);

      expect(prisma.path.create).toHaveBeenCalledWith({
        data: {
          title: createPathDto.title,
          description: createPathDto.description,
          publisherId: mockPublisher.id,
          followerIds: [],
        },
        include: { publisher: true },
      });
      expect(result).toEqual(mockPath);
    });

    it('should include publisher in response', async () => {
      const createPathDto = {
        title: 'Evening Jog',
        description: 'A relaxed jog',
      };

      jest.spyOn(prisma.path, 'create').mockResolvedValue(mockPath as any);

      const result = await service.createPath(mockPublisher.id, createPathDto);

      expect(result.publisher).toBeDefined();
      expect(result.publisherId).toBe(mockPublisher.id);
    });
  });

  describe('getAllPaths', () => {
    it('should return all paths with follower count', async () => {
      const paths = [mockPath];
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue(paths as any);

      const result = await service.getAllPaths();

      expect(prisma.path.findMany).toHaveBeenCalledWith({
        include: { publisher: true },
      });
      expect(result[0].followers).toBeDefined();
    });

    it('should return empty array when no paths exist', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([]);

      const result = await service.getAllPaths();

      expect(result).toEqual([]);
    });

    it('should include followers in response', async () => {
      const pathWithFollowers = {
        ...mockPath,
        followerIds: ['follower-1', 'follower-2'],
      };
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([pathWithFollowers] as any);

      const result = await service.getAllPaths();

      expect(result[0].followers).toEqual(['follower-1', 'follower-2']);
    });
  });

  describe('getPathById', () => {
    it('should return path by id', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(mockPath as any);

      const result = await service.getPathById(mockPath.id);

      expect(prisma.path.findUnique).toHaveBeenCalledWith({
        where: { id: mockPath.id },
        include: { publisher: true },
      });
      expect(result).toEqual(expect.objectContaining({ id: mockPath.id }));
    });

    it('should return null when path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      const result = await service.getPathById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include followers in response', async () => {
      const pathWithFollowers = {
        ...mockPath,
        followerIds: ['follower-1'],
      };
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollowers as any);

      const result = await service.getPathById(mockPath.id);

      expect(result?.followers).toEqual(['follower-1']);
    });
  });

  describe('getPublishedPathsByUser', () => {
    it('should return paths published by user', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([mockPath] as any);

      const result = await service.getPublishedPathsByUser(mockPublisher.id);

      expect(prisma.path.findMany).toHaveBeenCalledWith({
        where: { publisherId: mockPublisher.id },
        include: { publisher: true },
      });
      expect(result[0].publisherId).toBe(mockPublisher.id);
    });

    it('should return empty array when user has no published paths', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([]);

      const result = await service.getPublishedPathsByUser('unknown-user');

      expect(result).toEqual([]);
    });
  });

  describe('followPath', () => {
    it('should follow a path successfully', async () => {
      const updatedPath = { ...mockPath, followerIds: ['follower-123'] };
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(mockPath as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, mockFollower] as any);

      const result = await service.followPath(mockFollower.id, mockPath.id);

      expect(prisma.path.findUnique).toHaveBeenCalledWith({ where: { id: mockPath.id } });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.followers).toContain(mockFollower.id);
    });

    it('should throw error when path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.followPath(mockFollower.id, 'nonexistent')).rejects.toThrow('Path not found');
    });

    it('should throw error when already following', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);

      await expect(service.followPath(mockFollower.id, mockPath.id)).rejects.toThrow(
        'Already following this path',
      );
    });
  });

  describe('unfollowPath', () => {
    it('should unfollow a path successfully', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValueOnce(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, mockFollower] as any);

      const result = await service.unfollowPath(mockFollower.id, mockPath.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.followers).not.toContain(mockFollower.id);
    });

    it('should throw error when path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.unfollowPath(mockFollower.id, 'nonexistent')).rejects.toThrow('Path not found');
    });

    it('should throw error when user not found', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.unfollowPath(mockFollower.id, mockPath.id)).rejects.toThrow('User not found');
    });

    it('should handle null followerIds and followedPathIds', async () => {
      const pathWithNullFollowers = { ...mockPath, followerIds: null };
      const userWithNullFollowed = { ...mockFollower, followedPathIds: null };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullFollowers as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithNullFollowed as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, userWithNullFollowed] as any);

      const result = await service.unfollowPath(mockFollower.id, mockPath.id);

      expect(result.followers).toEqual([]);
    });

    it('should filter followedPathIds when present', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      const userWithFollowed = { ...mockFollower, followedPathIds: ['path-123', 'path-999'] };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithFollowed as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, userWithFollowed] as any);

      const result = await service.unfollowPath(mockFollower.id, mockPath.id);

      expect(result.followers).toEqual([]);
    });
  });

  describe('getFollowedPathsByUser', () => {
    it('should return paths followed by user', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([mockPath] as any);

      const result = await service.getFollowedPathsByUser(mockFollower.id);

      expect(prisma.path.findMany).toHaveBeenCalledWith({
        where: {
          followerIds: {
            has: mockFollower.id,
          },
        },
        include: { publisher: true },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when user follows no paths', async () => {
      jest.spyOn(prisma.path, 'findMany').mockResolvedValue([]);

      const result = await service.getFollowedPathsByUser(mockFollower.id);

      expect(result).toEqual([]);
    });
  });

  describe('updatePath', () => {
    it('should update path successfully', async () => {
      const updateData = {
        title: 'Updated Run',
        description: 'Updated description',
      };

      const updatedPath = { ...mockPath, ...updateData };
      jest.spyOn(prisma.path, 'update').mockResolvedValue(updatedPath as any);

      const result = await service.updatePath(mockPath.id, updateData);

      expect(prisma.path.update).toHaveBeenCalledWith({
        where: { id: mockPath.id },
        data: {
          title: updateData.title,
          description: updateData.description,
        },
        include: { publisher: true },
      });
      expect(result.title).toBe('Updated Run');
    });

    it('should include followers in updated path response', async () => {
      const updateData = {
        title: 'Updated Path',
        description: 'New description',
      };

      const updatedPath = { ...mockPath, ...updateData, followerIds: ['follower-1'] };
      jest.spyOn(prisma.path, 'update').mockResolvedValue(updatedPath as any);

      const result = await service.updatePath(mockPath.id, updateData);

      expect(result.followers).toEqual(['follower-1']);
    });
  });

  describe('deletePath', () => {
    it('should delete path successfully', async () => {
      jest.spyOn(prisma.path, 'delete').mockResolvedValue(mockPath as any);

      const result = await service.deletePath(mockPath.id);

      expect(prisma.path.delete).toHaveBeenCalledWith({
        where: { id: mockPath.id },
      });
      expect(result).toEqual(mockPath);
    });
  });

  describe('getFollowersWithDetails', () => {
    it('should return followers with details', async () => {
      const pathWithFollowers = { ...mockPath, followerIds: ['follower-123'] };
      const followers = [
        {
          id: 'follower-123',
          name: 'Follower Name',
          email: 'follower@example.com',
          picture: 'https://example.com/follower.jpg',
        },
      ];

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollowers as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(followers as any);

      const result = await service.getFollowersWithDetails(mockPath.id);

      expect(prisma.path.findUnique).toHaveBeenCalledWith({
        where: { id: mockPath.id },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['follower-123'],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          picture: true,
        },
      });
      expect(result).toEqual(followers);
    });

    it('should return empty array when path has no followers', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(mockPath as any);

      const result = await service.getFollowersWithDetails(mockPath.id);

      expect(result).toEqual([]);
    });

    it('should throw error when path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.getFollowersWithDetails('nonexistent')).rejects.toThrow('Path not found');
    });
  });

  describe('removeFollower', () => {
    it('should remove follower from path successfully', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValueOnce(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockFollower as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, mockFollower] as any);

      const result = await service.removeFollower(mockPath.id, mockFollower.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.followers).not.toContain(mockFollower.id);
    });

    it('should throw error when path not found', async () => {
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(null);

      await expect(service.removeFollower('nonexistent', mockFollower.id)).rejects.toThrow(
        'Path not found',
      );
    });

    it('should throw error when follower not found', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.removeFollower(mockPath.id, 'nonexistent')).rejects.toThrow(
        'Follower not found',
      );
    });

    it('should handle null followerIds and followedPathIds', async () => {
      const pathWithNullFollowers = { ...mockPath, followerIds: null };
      const userWithNullFollowed = { ...mockFollower, followedPathIds: null };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithNullFollowers as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithNullFollowed as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, userWithNullFollowed] as any);

      const result = await service.removeFollower(mockPath.id, mockFollower.id);

      expect(result.followers).toEqual([]);
    });

    it('should filter followedPathIds when present', async () => {
      const pathWithFollower = { ...mockPath, followerIds: ['follower-123'] };
      const userWithFollowed = { ...mockFollower, followedPathIds: ['path-123', 'path-999'] };
      const updatedPath = { ...mockPath, followerIds: [] };

      jest.spyOn(prisma.path, 'findUnique').mockResolvedValue(pathWithFollower as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithFollowed as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([updatedPath, userWithFollowed] as any);

      const result = await service.removeFollower(mockPath.id, mockFollower.id);

      expect(result.followers).toEqual([]);
    });
  });
});
