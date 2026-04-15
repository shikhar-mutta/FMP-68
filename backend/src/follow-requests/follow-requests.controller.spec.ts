import { Test, TestingModule } from '@nestjs/testing';
import { FollowRequestsController } from './follow-requests.controller';
import { FollowRequestsService } from './follow-requests.service';
import { CreateFollowRequestDto } from './dto/create-follow-request.dto';
import { ApproveFollowRequestDto } from './dto/approve-follow-request.dto';
import { HttpException } from '@nestjs/common';

describe('FollowRequestsController', () => {
  let controller: FollowRequestsController;
  let followRequestsService: FollowRequestsService;

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
    followRequests: [mockFollower.id],
    coordinates: [],
    status: 'idle',
    isLive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    publisher: mockPublisher,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowRequestsController],
      providers: [
        {
          provide: FollowRequestsService,
          useValue: {
            createFollowRequest: jest.fn(),
            getPendingFollowRequestsForPublisher: jest.fn(),
            getFollowRequestsSentByUser: jest.fn(),
            getFollowRequestsForPath: jest.fn(),
            approveFollowRequest: jest.fn(),
            rejectFollowRequest: jest.fn(),
            cancelFollowRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FollowRequestsController>(FollowRequestsController);
    followRequestsService = module.get<FollowRequestsService>(FollowRequestsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createFollowRequest', () => {
    it('should create a follow request successfully', async () => {
      const createFollowRequestDto: CreateFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      jest.spyOn(followRequestsService, 'createFollowRequest').mockResolvedValue({
        pathId: 'path-123',
        publisherId: mockPublisher.id,
        followerId: mockFollower.id,
        follower: mockFollower,
        message: 'Follow request created',
        path: mockPath,
      } as any);

      const result = await controller.createFollowRequest(
        { user: { id: mockFollower.id } },
        createFollowRequestDto,
      );

      expect(followRequestsService.createFollowRequest).toHaveBeenCalledWith(
        mockFollower.id,
        createFollowRequestDto,
      );
      expect(result.message).toBe('Follow request created');
    });

    it('should throw error on service failure', async () => {
      const createFollowRequestDto: CreateFollowRequestDto = {
        pathId: 'path-123',
        publisherId: mockPublisher.id,
      };

      jest
        .spyOn(followRequestsService, 'createFollowRequest')
        .mockRejectedValue(new Error('Path not found'));

      await expect(
        controller.createFollowRequest({ user: { id: mockFollower.id } }, createFollowRequestDto),
      ).rejects.toThrow();
    });
  });

  describe('getPendingFollowRequests', () => {
    it('should return pending follow requests', async () => {
      jest
        .spyOn(followRequestsService, 'getPendingFollowRequestsForPublisher')
        .mockResolvedValue([{ pathId: 'path-123' }] as any);

      const result = await controller.getPendingFollowRequests({
        user: { id: mockPublisher.id },
      });

      expect(result).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      jest
        .spyOn(followRequestsService, 'getPendingFollowRequestsForPublisher')
        .mockResolvedValue([]);

      const result = await controller.getPendingFollowRequests({
        user: { id: mockPublisher.id },
      });

      expect(result).toEqual([]);
    });

    it('should throw error on service failure', async () => {
      jest
        .spyOn(followRequestsService, 'getPendingFollowRequestsForPublisher')
        .mockRejectedValue(new Error('DB error'));

      await expect(
        controller.getPendingFollowRequests({ user: { id: mockPublisher.id } }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error on service failure with non-Error', async () => {
      jest
        .spyOn(followRequestsService, 'getPendingFollowRequestsForPublisher')
        .mockRejectedValue('string error');

      await expect(
        controller.getPendingFollowRequests({ user: { id: mockPublisher.id } }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getSentFollowRequests', () => {
    it('should return sent follow requests', async () => {
      jest
        .spyOn(followRequestsService, 'getFollowRequestsSentByUser')
        .mockResolvedValue([{ pathId: 'path-123' }] as any);

      const result = await controller.getSentFollowRequests({
        user: { id: mockFollower.id },
      });

      expect(result).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      jest.spyOn(followRequestsService, 'getFollowRequestsSentByUser').mockResolvedValue([]);

      const result = await controller.getSentFollowRequests({
        user: { id: mockFollower.id },
      });

      expect(result).toEqual([]);
    });

    it('should throw error on service failure', async () => {
      jest
        .spyOn(followRequestsService, 'getFollowRequestsSentByUser')
        .mockRejectedValue(new Error('Error'));

      await expect(
        controller.getSentFollowRequests({ user: { id: mockFollower.id } }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw error when non-Error is rejected', async () => {
      jest
        .spyOn(followRequestsService, 'getFollowRequestsSentByUser')
        .mockRejectedValue(null);

      await expect(
        controller.getSentFollowRequests({ user: { id: mockFollower.id } }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getFollowRequestsForPath', () => {
    it('should return follow requests for a path', async () => {
      jest
        .spyOn(followRequestsService, 'getFollowRequestsForPath')
        .mockResolvedValue([{ follower: mockFollower }] as any);

      const result = await controller.getFollowRequestsForPath('path-123');

      expect(result).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      jest.spyOn(followRequestsService, 'getFollowRequestsForPath').mockResolvedValue([]);

      const result = await controller.getFollowRequestsForPath('path-123');

      expect(result).toEqual([]);
    });

    it('should throw error on service failure', async () => {
      jest
        .spyOn(followRequestsService, 'getFollowRequestsForPath')
        .mockRejectedValue(new Error('Error'));

      await expect(controller.getFollowRequestsForPath('path-123')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error when non-Error is rejected', async () => {
      jest.spyOn(followRequestsService, 'getFollowRequestsForPath').mockRejectedValue(null);

      await expect(controller.getFollowRequestsForPath('path-123')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('approveFollowRequest', () => {
    it('should approve a follow request', async () => {
      const approveDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest.spyOn(followRequestsService, 'approveFollowRequest').mockResolvedValue({
        message: 'Approved',
      } as any);

      const result = await controller.approveFollowRequest(
        { user: { id: mockPublisher.id } },
        approveDto,
      );

      expect(result.message).toBe('Approved');
    });

    it('should throw error when not authorized', async () => {
      const approveDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest
        .spyOn(followRequestsService, 'approveFollowRequest')
        .mockRejectedValue(new Error('Unauthorized'));

      await expect(
        controller.approveFollowRequest({ user: { id: 'different-user' } }, approveDto),
      ).rejects.toThrow();
    });

    it('should throw error on service failure', async () => {
      const approveDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest
        .spyOn(followRequestsService, 'approveFollowRequest')
        .mockRejectedValue(new Error('Error'));

      await expect(
        controller.approveFollowRequest({ user: { id: mockPublisher.id } }, approveDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('rejectFollowRequest', () => {
    it('should reject a follow request', async () => {
      const rejectDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest.spyOn(followRequestsService, 'rejectFollowRequest').mockResolvedValue({
        message: 'Rejected',
      } as any);

      const result = await controller.rejectFollowRequest(
        { user: { id: mockPublisher.id } },
        rejectDto,
      );

      expect(result.message).toBe('Rejected');
    });

    it('should throw error on service failure', async () => {
      const rejectDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest
        .spyOn(followRequestsService, 'rejectFollowRequest')
        .mockRejectedValue(new Error('Error'));

      await expect(
        controller.rejectFollowRequest({ user: { id: mockPublisher.id } }, rejectDto),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('cancelFollowRequest', () => {
    it('should cancel a follow request', async () => {
      const cancelDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest.spyOn(followRequestsService, 'cancelFollowRequest').mockResolvedValue({
        message: 'Cancelled',
      } as any);

      const result = await controller.cancelFollowRequest(
        { user: { id: mockFollower.id } },
        cancelDto,
      );

      expect(result.message).toBe('Cancelled');
    });

    it('should throw error on service failure', async () => {
      const cancelDto: ApproveFollowRequestDto = {
        userId: mockFollower.id,
        pathId: 'path-123',
      };

      jest
        .spyOn(followRequestsService, 'cancelFollowRequest')
        .mockRejectedValue(new Error('Error'));

      await expect(
        controller.cancelFollowRequest({ user: { id: mockFollower.id } }, cancelDto),
      ).rejects.toThrow(HttpException);
    });
  });
});
