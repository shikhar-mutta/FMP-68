import { FollowRequestsController } from './follow-requests.controller';
import { FollowRequestsService } from './follow-requests.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

// ── from follow-requests.service.spec.ts ──
describe('FollowRequestsService', () => {
  let repo: any;
  let usersClient: any;
  let notificationsService: any;
  let service: FollowRequestsService;

  const follower = { id: 'u-follower', followedPathIds: [] };
  const publisher = { id: 'u-owner' };
  const path = {
    id: 'p1',
    title: 'Trail',
    publisherId: 'u-owner',
    publisher,
    followRequests: [],
    followerIds: [],
  };

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByIdWithPublisher: jest.fn(),
      findByPublisher: jest.fn(),
      findAllWithPublisher: jest.fn(),
      setFollowRequests: jest.fn(),
      approveFollowRequest: jest.fn(),
    };
    usersClient = { findById: jest.fn(), findManyByIds: jest.fn() };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    service = new FollowRequestsService(repo, usersClient, notificationsService);
  });

  describe('createFollowRequest', () => {
    it('appends the follower to followRequests when not already present', async () => {
      usersClient.findById.mockResolvedValue(follower);
      repo.findByIdWithPublisher.mockResolvedValue(path);
      repo.setFollowRequests.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });

      const result = await service.createFollowRequest('u-follower', {
        pathId: 'p1',
        publisherId: 'u-owner',
      } as any);

      expect(repo.setFollowRequests).toHaveBeenCalledWith('p1', ['u-follower']);
      expect(result.pathId).toBe('p1');
      expect(result.follower).toBe(follower);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersClient.findById.mockResolvedValue(null);
      await expect(
        service.createFollowRequest('u', {
          pathId: 'p1',
          publisherId: 'u-owner',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the path does not exist', async () => {
      usersClient.findById.mockResolvedValue(follower);
      repo.findByIdWithPublisher.mockResolvedValue(null);
      await expect(
        service.createFollowRequest('u-follower', {
          pathId: 'p1',
          publisherId: 'u-owner',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when publisherId does not match the path owner', async () => {
      usersClient.findById.mockResolvedValue(follower);
      repo.findByIdWithPublisher.mockResolvedValue(path);
      await expect(
        service.createFollowRequest('u-follower', {
          pathId: 'p1',
          publisherId: 'someone-else',
        } as any),
      ).rejects.toThrow('Publisher does not own this path');
    });

    it('throws when the follower already has a pending request', async () => {
      usersClient.findById.mockResolvedValue(follower);
      repo.findByIdWithPublisher.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });
      await expect(
        service.createFollowRequest('u-follower', {
          pathId: 'p1',
          publisherId: 'u-owner',
        } as any),
      ).rejects.toThrow('Follow request already pending for this user');
    });

    it('throws when the follower is already following', async () => {
      usersClient.findById.mockResolvedValue(follower);
      repo.findByIdWithPublisher.mockResolvedValue({
        ...path,
        followerIds: ['u-follower'],
      });
      await expect(
        service.createFollowRequest('u-follower', {
          pathId: 'p1',
          publisherId: 'u-owner',
        } as any),
      ).rejects.toThrow('User is already following this path');
    });
  });

  describe('approveFollowRequest', () => {
    it('moves the user from followRequests to followerIds', async () => {
      repo.findById.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });
      repo.approveFollowRequest.mockResolvedValue([
        { ...path, followRequests: [], followerIds: ['u-follower'] },
      ]);

      await service.approveFollowRequest('p1', 'u-follower', 'u-owner');

      expect(repo.approveFollowRequest).toHaveBeenCalledWith(
        'p1',
        'u-follower',
        [],
        ['u-follower'],
      );
    });

    it('throws ForbiddenException when caller is not the publisher', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.approveFollowRequest('p1', 'u-follower', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.approveFollowRequest('p1', 'u-follower', 'u-owner'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when no follow request exists for the user', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.approveFollowRequest('p1', 'u-follower', 'u-owner'),
      ).rejects.toThrow('Follow request not found');
    });
  });

  describe('rejectFollowRequest', () => {
    it('removes the user from followRequests', async () => {
      repo.findById.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });
      await service.rejectFollowRequest('p1', 'u-follower', 'u-owner');
      expect(repo.setFollowRequests).toHaveBeenCalledWith('p1', []);
    });

    it('throws ForbiddenException when not the publisher', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.rejectFollowRequest('p1', 'u-follower', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.rejectFollowRequest('p1', 'u', 'u-owner'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when no follow request exists for the user', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.rejectFollowRequest('p1', 'u-missing', 'u-owner'),
      ).rejects.toThrow('Follow request not found');
    });
  });

  describe('cancelFollowRequest', () => {
    it('removes the user from followRequests', async () => {
      repo.findById.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });
      await service.cancelFollowRequest('p1', 'u-follower');
      expect(repo.setFollowRequests).toHaveBeenCalledWith('p1', []);
    });

    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.cancelFollowRequest('p1', 'u'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when no follow request exists for the user', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.cancelFollowRequest('p1', 'u-missing'),
      ).rejects.toThrow('Follow request not found');
    });
  });

  describe('getPendingFollowRequestsForPublisher', () => {
    it('returns enriched request objects with follower details', async () => {
      repo.findByPublisher.mockResolvedValue([
        {
          id: 'p1',
          title: 'A',
          followRequests: ['u-follower'],
          publisher: { id: 'u-owner' },
        },
      ]);
      usersClient.findManyByIds.mockResolvedValue([
        { id: 'u-follower', name: 'Alice' },
      ]);

      const result = await service.getPendingFollowRequestsForPublisher(
        'u-owner',
      );

      expect(usersClient.findManyByIds).toHaveBeenCalledWith(['u-follower']);
      expect(result).toEqual([
        {
          pathId: 'p1',
          pathTitle: 'A',
          publisherId: 'u-owner',
          publisher: { id: 'u-owner' },
          followerId: 'u-follower',
          follower: { id: 'u-follower', name: 'Alice' },
        },
      ]);
    });

    it('skips requests whose follower record is missing', async () => {
      repo.findByPublisher.mockResolvedValue([
        { id: 'p1', followRequests: ['u-missing'], publisher: {} },
      ]);
      usersClient.findManyByIds.mockResolvedValue([]);
      await expect(
        service.getPendingFollowRequestsForPublisher('u-owner'),
      ).resolves.toEqual([]);
    });
  });

  describe('getFollowRequestsForPath', () => {
    it('returns the requests with their follower records', async () => {
      repo.findByIdWithPublisher.mockResolvedValue({
        ...path,
        followRequests: ['u-follower'],
      });
      usersClient.findManyByIds.mockResolvedValue([
        { id: 'u-follower', name: 'Alice' },
      ]);

      const result = await service.getFollowRequestsForPath('p1');

      expect(result).toEqual([
        {
          pathId: 'p1',
          followerId: 'u-follower',
          follower: { id: 'u-follower', name: 'Alice' },
        },
      ]);
    });

    it('returns an empty list when there are no requests', async () => {
      repo.findByIdWithPublisher.mockResolvedValue(path);
      await expect(
        service.getFollowRequestsForPath('p1'),
      ).resolves.toEqual([]);
      expect(usersClient.findManyByIds).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the path is missing', async () => {
      repo.findByIdWithPublisher.mockResolvedValue(null);
      await expect(
        service.getFollowRequestsForPath('p1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getFollowRequestsSentByUser', () => {
    it('labels pending and approved correctly', async () => {
      repo.findAllWithPublisher.mockResolvedValue([
        {
          id: 'p1',
          title: 'T1',
          publisherId: 'u-owner',
          publisher: { id: 'u-owner' },
          followRequests: ['u-follower'],
          followerIds: [],
        },
        {
          id: 'p2',
          title: 'T2',
          publisherId: 'u-owner',
          publisher: { id: 'u-owner' },
          followRequests: [],
          followerIds: ['u-follower'],
        },
        {
          id: 'p3',
          title: 'T3',
          publisherId: 'u-owner',
          publisher: { id: 'u-owner' },
          followRequests: [],
          followerIds: [],
        },
      ]);

      const result = await service.getFollowRequestsSentByUser('u-follower');

      expect(result).toHaveLength(2);
      const statuses = result.map((r: any) => ({
        pathId: r.pathId,
        status: r.status,
      }));
      expect(statuses).toEqual([
        { pathId: 'p1', status: 'PENDING' },
        { pathId: 'p2', status: 'APPROVED' },
      ]);
    });
  });
});

// ── from follow-requests.controller.spec.ts ──
describe('FollowRequestsController', () => {
  let svc: any;
  let controller: FollowRequestsController;

  beforeEach(() => {
    svc = {
      createFollowRequest: jest.fn(),
      getPendingFollowRequestsForPublisher: jest.fn(),
      getFollowRequestsSentByUser: jest.fn(),
      getFollowRequestsForPath: jest.fn(),
      approveFollowRequest: jest.fn(),
      rejectFollowRequest: jest.fn(),
      cancelFollowRequest: jest.fn(),
    };
    controller = new FollowRequestsController(svc);
  });

  it('createFollowRequest happy path', async () => {
    svc.createFollowRequest.mockResolvedValue({ ok: true });
    await expect(
      controller.createFollowRequest('u1', {
        pathId: 'p1',
        publisherId: 'u-owner',
      } as any),
    ).resolves.toEqual({ ok: true });
  });

  it('createFollowRequest wraps errors as 400 BadRequest', async () => {
    svc.createFollowRequest.mockRejectedValue(new Error('nope'));
    await expect(
      controller.createFollowRequest('u1', {
        pathId: 'p1',
        publisherId: 'u-owner',
      } as any),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('getPendingFollowRequests forwards user id', async () => {
    await controller.getPendingFollowRequests('u-owner');
    expect(svc.getPendingFollowRequestsForPublisher).toHaveBeenCalledWith(
      'u-owner',
    );
  });

  it('getPendingFollowRequests wraps errors as 400', async () => {
    svc.getPendingFollowRequestsForPublisher.mockRejectedValue(
      new Error('nope'),
    );
    await expect(
      controller.getPendingFollowRequests('u'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('getSentFollowRequests forwards user id', async () => {
    await controller.getSentFollowRequests('u');
    expect(svc.getFollowRequestsSentByUser).toHaveBeenCalledWith('u');
  });

  it('getSentFollowRequests wraps errors as 400', async () => {
    svc.getFollowRequestsSentByUser.mockRejectedValue(new Error('nope'));
    await expect(
      controller.getSentFollowRequests('u'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('getFollowRequestsForPath forwards path id', async () => {
    await controller.getFollowRequestsForPath('p1');
    expect(svc.getFollowRequestsForPath).toHaveBeenCalledWith('p1');
  });

  it('getFollowRequestsForPath wraps errors as 400', async () => {
    svc.getFollowRequestsForPath.mockRejectedValue(new Error('nope'));
    await expect(
      controller.getFollowRequestsForPath('p1'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('approveFollowRequest forwards args', async () => {
    await controller.approveFollowRequest('u-owner', {
      pathId: 'p1',
      userId: 'u-follower',
    } as any);
    expect(svc.approveFollowRequest).toHaveBeenCalledWith(
      'p1',
      'u-follower',
      'u-owner',
    );
  });

  it('approveFollowRequest wraps errors as 400', async () => {
    svc.approveFollowRequest.mockRejectedValue(new Error('nope'));
    await expect(
      controller.approveFollowRequest('u', {
        pathId: 'p1',
        userId: 'u',
      } as any),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejectFollowRequest forwards args', async () => {
    await controller.rejectFollowRequest('u-owner', {
      pathId: 'p1',
      userId: 'u-follower',
    } as any);
    expect(svc.rejectFollowRequest).toHaveBeenCalledWith(
      'p1',
      'u-follower',
      'u-owner',
    );
  });

  it('rejectFollowRequest wraps errors as 400', async () => {
    svc.rejectFollowRequest.mockRejectedValue(new Error('nope'));
    await expect(
      controller.rejectFollowRequest('u', {
        pathId: 'p1',
        userId: 'u',
      } as any),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('cancelFollowRequest forwards args', async () => {
    await controller.cancelFollowRequest('u', { pathId: 'p1' });
    expect(svc.cancelFollowRequest).toHaveBeenCalledWith('p1', 'u');
  });

  it('cancelFollowRequest wraps errors as 400', async () => {
    svc.cancelFollowRequest.mockRejectedValue(new Error('nope'));
    await expect(
      controller.cancelFollowRequest('u', { pathId: 'p1' }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('cancelFollowRequest uses fallback message for non-Error throwables', async () => {
    svc.cancelFollowRequest.mockRejectedValue('weird');
    try {
      await controller.cancelFollowRequest('u', { pathId: 'p1' });
      fail('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
