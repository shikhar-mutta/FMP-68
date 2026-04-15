import { Test, TestingModule } from '@nestjs/testing';
import { PathsController } from './paths.controller';
import { PathsService } from './paths.service';
import { CreatePathDto } from './dto/create-path.dto';

describe('PathsController', () => {
  let controller: PathsController;
  let pathsService: PathsService;

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
    followers: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PathsController],
      providers: [
        {
          provide: PathsService,
          useValue: {
            createPath: jest.fn(),
            getAllPaths: jest.fn(),
            getPathById: jest.fn(),
            getPublishedPathsByUser: jest.fn(),
            getFollowedPathsByUser: jest.fn(),
            followPath: jest.fn(),
            unfollowPath: jest.fn(),
            updatePath: jest.fn(),
            deletePath: jest.fn(),
            getFollowersWithDetails: jest.fn(),
            removeFollower: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PathsController>(PathsController);
    pathsService = module.get<PathsService>(PathsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPath', () => {
    it('should create a new path', async () => {
      const createPathDto: CreatePathDto = {
        title: 'Evening Jog',
        description: 'A relaxed jog',
      };

      jest.spyOn(pathsService, 'createPath').mockResolvedValue(mockPath as any);

      const result = await controller.createPath({ user: { id: mockPublisher.id } }, createPathDto);

      expect(pathsService.createPath).toHaveBeenCalledWith(mockPublisher.id, createPathDto);
      expect(result).toEqual(mockPath);
    });
  });

  describe('getAllPaths', () => {
    it('should return all paths', async () => {
      jest.spyOn(pathsService, 'getAllPaths').mockResolvedValue([mockPath] as any);

      const result = await controller.getAllPaths();

      expect(pathsService.getAllPaths).toHaveBeenCalled();
      expect(result).toEqual([mockPath]);
    });

    it('should return empty array when no paths exist', async () => {
      jest.spyOn(pathsService, 'getAllPaths').mockResolvedValue([]);

      const result = await controller.getAllPaths();

      expect(result).toEqual([]);
    });
  });

  describe('getPathById', () => {
    it('should return path by id', async () => {
      jest.spyOn(pathsService, 'getPathById').mockResolvedValue(mockPath as any);

      const result = await controller.getPathById(mockPath.id);

      expect(pathsService.getPathById).toHaveBeenCalledWith(mockPath.id);
      expect(result).toEqual(mockPath);
    });

    it('should return null when path not found', async () => {
      jest.spyOn(pathsService, 'getPathById').mockResolvedValue(null);

      const result = await controller.getPathById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMyPublishedPaths', () => {
    it('should return paths published by user', async () => {
      jest.spyOn(pathsService, 'getPublishedPathsByUser').mockResolvedValue([mockPath] as any);

      const result = await controller.getMyPublishedPaths({
        user: { id: mockPublisher.id },
      });

      expect(pathsService.getPublishedPathsByUser).toHaveBeenCalledWith(mockPublisher.id);
      expect(result).toEqual([mockPath]);
    });
  });

  describe('getMyFollowedPaths', () => {
    it('should return paths followed by user', async () => {
      jest.spyOn(pathsService, 'getFollowedPathsByUser').mockResolvedValue([mockPath] as any);

      const follower = { ...mockPublisher, id: 'follower-123' };

      const result = await controller.getMyFollowedPaths({
        user: { id: follower.id },
      });

      expect(pathsService.getFollowedPathsByUser).toHaveBeenCalledWith(follower.id);
      expect(result).toEqual([mockPath]);
    });
  });

  describe('followPath', () => {
    it('should follow a path', async () => {
      const follower = { ...mockPublisher, id: 'follower-123' };
      jest.spyOn(pathsService, 'followPath').mockResolvedValue({
        ...mockPath,
        followerIds: [follower.id],
        followers: [follower.id],
      } as any);

      const result = await controller.followPath(
        { user: { id: follower.id } },
        mockPath.id,
      );

      expect(pathsService.followPath).toHaveBeenCalledWith(follower.id, mockPath.id);
      expect(result.followers).toContain(follower.id);
    });
  });

  describe('unfollowPath', () => {
    it('should unfollow a path', async () => {
      const follower = { ...mockPublisher, id: 'follower-123' };
      jest.spyOn(pathsService, 'unfollowPath').mockResolvedValue({
        ...mockPath,
        followerIds: [],
        followers: [],
      } as any);

      const result = await controller.unfollowPath(
        { user: { id: follower.id } },
        mockPath.id,
      );

      expect(pathsService.unfollowPath).toHaveBeenCalledWith(follower.id, mockPath.id);
      expect(result.followers).not.toContain(follower.id);
    });
  });

  describe('updatePath', () => {
    it('should update an existing path', async () => {
      const updatePathDto: CreatePathDto = {
        title: 'Updated Path Title',
        description: 'Updated description',
      };

      const updatedPath = { ...mockPath, ...updatePathDto };
      jest.spyOn(pathsService, 'updatePath').mockResolvedValue(updatedPath as any);

      const result = await controller.updatePath(mockPath.id, updatePathDto);

      expect(pathsService.updatePath).toHaveBeenCalledWith(mockPath.id, updatePathDto);
      expect(result.title).toBe('Updated Path Title');
    });

    it('should handle update errors gracefully', async () => {
      const updatePathDto: CreatePathDto = {
        title: 'New Title',
        description: 'New desc',
      };

      jest
        .spyOn(pathsService, 'updatePath')
        .mockRejectedValue(new Error('Path not found'));

      await expect(controller.updatePath('invalid-id', updatePathDto)).rejects.toThrow(
        'Path not found',
      );
    });
  });

  describe('deletePath', () => {
    it('should delete a path', async () => {
      jest.spyOn(pathsService, 'deletePath').mockResolvedValue({ id: mockPath.id } as any);

      const result = await controller.deletePath(mockPath.id);

      expect(pathsService.deletePath).toHaveBeenCalledWith(mockPath.id);
      expect(result.id).toBe(mockPath.id);
    });

    it('should handle delete errors', async () => {
      jest
        .spyOn(pathsService, 'deletePath')
        .mockRejectedValue(new Error('Path not found'));

      await expect(controller.deletePath('invalid-id')).rejects.toThrow('Path not found');
    });
  });

  describe('getFollowers', () => {
    it('should return followers of a path', async () => {
      const follower1 = { ...mockPublisher, id: 'follower-1', name: 'Follower 1' };
      const follower2 = { ...mockPublisher, id: 'follower-2', name: 'Follower 2' };

      jest
        .spyOn(pathsService, 'getFollowersWithDetails')
        .mockResolvedValue([follower1, follower2] as any);

      const result = await controller.getFollowers(mockPath.id);

      expect(pathsService.getFollowersWithDetails).toHaveBeenCalledWith(mockPath.id);
      expect(result).toHaveLength(2);
      expect(result).toEqual([follower1, follower2]);
    });

    it('should return empty array when no followers', async () => {
      jest.spyOn(pathsService, 'getFollowersWithDetails').mockResolvedValue([]);

      const result = await controller.getFollowers(mockPath.id);

      expect(result).toEqual([]);
    });
  });

  describe('removeFollower', () => {
    it('should remove a follower from path', async () => {
      const follower = { ...mockPublisher, id: 'follower-123' };

      jest
        .spyOn(pathsService, 'getPathById')
        .mockResolvedValue({ ...mockPath, publisher: mockPublisher } as any);

      jest.spyOn(pathsService, 'removeFollower').mockResolvedValue({
        ...mockPath,
        followerIds: [],
      } as any);

      const result = await controller.removeFollower(
        { user: { id: mockPublisher.id } },
        mockPath.id,
        follower.id,
      );

      expect(pathsService.removeFollower).toHaveBeenCalledWith(mockPath.id, follower.id);
      expect(result.followerIds).toEqual([]);
    });

    it('should throw error when not the publisher', async () => {
      const follower = { ...mockPublisher, id: 'follower-123' };

      jest
        .spyOn(pathsService, 'getPathById')
        .mockResolvedValue({ ...mockPath, publisher: mockPublisher } as any);

      await expect(
        controller.removeFollower(
          { user: { id: 'different-user-id' } },
          mockPath.id,
          follower.id,
        ),
      ).rejects.toThrow('Only the publisher can remove followers');
    });

    it('should throw error when path not found', async () => {
      const follower = { ...mockPublisher, id: 'follower-123' };

      jest.spyOn(pathsService, 'getPathById').mockResolvedValue(null);

      await expect(
        controller.removeFollower(
          { user: { id: mockPublisher.id } },
          'nonexistent',
          follower.id,
        ),
      ).rejects.toThrow('Path not found');
    });
  });
});
