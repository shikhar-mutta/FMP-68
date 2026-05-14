/**
 * Consolidated unit tests for the paths module.
 *   - path.mapper (pure functions)
 *   - PathsService (orchestration over repo + followers)
 *   - PathsRepository (Prisma wrapper)
 *   - PathFollowersService (follower lifecycle)
 *   - PathsController (HTTP handlers)
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  asStringList,
  toPathResponse,
  toPathResponses,
  withValueOnce,
  withoutValue,
} from './path.mapper';
import { PathsService } from './paths.service';
import { PathsRepository } from './paths.repository';
import { PathFollowersService } from './path-followers.service';
import { PathsController } from './paths.controller';

// ───────────────────────────── path.mapper ─────────────────────────────
describe('path.mapper', () => {
  describe('asStringList', () => {
    it('returns the same array when given an array', () => {
      const arr = ['a', 'b'];
      expect(asStringList(arr)).toBe(arr);
    });
    it('returns an empty array for null', () => {
      expect(asStringList(null)).toEqual([]);
    });
    it('returns an empty array for undefined', () => {
      expect(asStringList(undefined)).toEqual([]);
    });
  });

  describe('withoutValue', () => {
    it('removes all matching values', () => {
      expect(withoutValue(['a', 'b', 'a', 'c'], 'a')).toEqual(['b', 'c']);
    });
    it('returns a new array (no mutation)', () => {
      const input = ['a', 'b'];
      const out = withoutValue(input, 'a');
      expect(out).not.toBe(input);
      expect(input).toEqual(['a', 'b']);
    });
    it('returns equivalent contents when value is not present', () => {
      expect(withoutValue(['a', 'b'], 'z')).toEqual(['a', 'b']);
    });
  });

  describe('withValueOnce', () => {
    it('appends the value when it is missing', () => {
      expect(withValueOnce(['a'], 'b')).toEqual(['a', 'b']);
    });
    it('returns the same array when the value is already present', () => {
      const input = ['a', 'b'];
      expect(withValueOnce(input, 'a')).toBe(input);
    });
  });

  describe('toPathResponse', () => {
    it('exposes followers derived from followerIds', () => {
      const path = { id: 'p1', followerIds: ['u1', 'u2'] };
      const result = toPathResponse(path);
      expect(result.followers).toEqual(['u1', 'u2']);
      expect(result.id).toBe('p1');
    });
    it('exposes an empty followers array when followerIds is missing', () => {
      const path = { id: 'p2' } as any;
      expect(toPathResponse(path).followers).toEqual([]);
    });
    it('does not mutate the input path', () => {
      const path = { id: 'p1', followerIds: ['u1'] };
      toPathResponse(path);
      expect(path).toEqual({ id: 'p1', followerIds: ['u1'] });
    });
  });

  describe('toPathResponses', () => {
    it('maps every path in the list', () => {
      const paths = [
        { id: 'p1', followerIds: ['u1'] },
        { id: 'p2', followerIds: null },
      ];
      const result = toPathResponses(paths);
      expect(result).toHaveLength(2);
      expect(result[0].followers).toEqual(['u1']);
      expect(result[1].followers).toEqual([]);
    });
    it('returns an empty list for an empty input', () => {
      expect(toPathResponses([])).toEqual([]);
    });
  });
});

// ───────────────────────────── PathsService ─────────────────────────────
describe('PathsService', () => {
  let repo: jest.Mocked<PathsRepository>;
  let followers: jest.Mocked<PathFollowersService>;
  let service: PathsService;

  const rawPath = {
    id: 'p1',
    title: 'Trail A',
    description: 'desc',
    publisherId: 'u1',
    followerIds: ['u2', 'u3'],
    publisher: { id: 'u1', name: 'Alice' },
  } as any;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAllWithPublisher: jest.fn(),
      findByIdWithPublisher: jest.fn(),
      findByPublisher: jest.fn(),
      findFollowedByUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<PathsRepository>;

    followers = {
      followPath: jest.fn(),
      unfollowPath: jest.fn(),
      getFollowersWithDetails: jest.fn(),
      removeFollower: jest.fn(),
      assertPublisherCanManageFollowers: jest.fn(),
    } as unknown as jest.Mocked<PathFollowersService>;

    service = new PathsService(repo, followers);
  });

  it('createPath delegates to repository.create', async () => {
    repo.create.mockResolvedValue(rawPath);
    await service.createPath('u1', { title: 'Trail A', description: 'desc' });
    expect(repo.create).toHaveBeenCalledWith('u1', {
      title: 'Trail A',
      description: 'desc',
    });
  });

  it('getAllPaths returns mapped paths', async () => {
    repo.findAllWithPublisher.mockResolvedValue([rawPath]);
    const result = await service.getAllPaths();
    expect(result[0].followers).toEqual(['u2', 'u3']);
  });

  describe('getPathById', () => {
    it('returns mapped path when found', async () => {
      repo.findByIdWithPublisher.mockResolvedValue(rawPath);
      const result = await service.getPathById('p1');
      expect(result?.followers).toEqual(['u2', 'u3']);
    });
    it('returns null when path is missing', async () => {
      repo.findByIdWithPublisher.mockResolvedValue(null);
      await expect(service.getPathById('missing')).resolves.toBeNull();
    });
  });

  it('followPath delegates to PathFollowersService', async () => {
    await service.followPath('u2', 'p1');
    expect(followers.followPath).toHaveBeenCalledWith('u2', 'p1');
  });

  it('unfollowPath delegates to PathFollowersService', async () => {
    await service.unfollowPath('u2', 'p1');
    expect(followers.unfollowPath).toHaveBeenCalledWith('u2', 'p1');
  });

  it('updatePath returns a mapped response after updating', async () => {
    repo.update.mockResolvedValue({ ...rawPath, title: 'Renamed' });
    const result = await service.updatePath('p1', {
      title: 'Renamed',
      description: 'desc',
    });
    expect(result.title).toBe('Renamed');
    expect(result.followers).toEqual(['u2', 'u3']);
  });

  it('assertPublisherCanManageFollowers forwards to PathFollowersService', async () => {
    await service.assertPublisherCanManageFollowers('p1', 'u1');
    expect(followers.assertPublisherCanManageFollowers).toHaveBeenCalledWith(
      'p1',
      'u1',
    );
  });

  it('getPublishedPathsByUser returns mapped paths for the user', async () => {
    repo.findByPublisher.mockResolvedValue([rawPath]);
    const result = await service.getPublishedPathsByUser('u1');
    expect(repo.findByPublisher).toHaveBeenCalledWith('u1');
    expect(result[0].followers).toEqual(['u2', 'u3']);
  });

  it('getFollowedPathsByUser returns mapped paths followed by the user', async () => {
    repo.findFollowedByUser.mockResolvedValue([rawPath]);
    const result = await service.getFollowedPathsByUser('u2');
    expect(repo.findFollowedByUser).toHaveBeenCalledWith('u2');
    expect(result[0].followers).toEqual(['u2', 'u3']);
  });

  it('deletePath delegates to repository.delete', async () => {
    await service.deletePath('p1');
    expect(repo.delete).toHaveBeenCalledWith('p1');
  });

  it('getFollowersWithDetails forwards to PathFollowersService', async () => {
    await service.getFollowersWithDetails('p1');
    expect(followers.getFollowersWithDetails).toHaveBeenCalledWith('p1');
  });

  it('removeFollower forwards to PathFollowersService', async () => {
    await service.removeFollower('p1', 'u2');
    expect(followers.removeFollower).toHaveBeenCalledWith('p1', 'u2');
  });
});

// ───────────────────────────── PathsRepository ─────────────────────────────
describe('PathsRepository', () => {
  let prisma: any;
  let repo: PathsRepository;

  beforeEach(() => {
    prisma = {
      path: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { update: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(['tx']),
    };
    repo = new PathsRepository(prisma);
  });

  it('create sets publisherId, empty followerIds, and includes publisher', () => {
    repo.create('u1', { title: 'T', description: 'D' } as any);
    const args = prisma.path.create.mock.calls[0][0];
    expect(args.data.publisherId).toBe('u1');
    expect(args.data.followerIds).toEqual([]);
    expect(args.include.publisher).toBe(true);
  });

  it('findAllWithPublisher includes publisher', () => {
    repo.findAllWithPublisher();
    expect(prisma.path.findMany).toHaveBeenCalledWith({
      include: { publisher: true },
    });
  });

  it('findById queries by id', () => {
    repo.findById('p1');
    expect(prisma.path.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
    });
  });

  it('findByIdWithPublisher includes publisher', () => {
    repo.findByIdWithPublisher('p1');
    expect(prisma.path.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: { publisher: true },
    });
  });

  it('findByPublisher filters by publisherId', () => {
    repo.findByPublisher('u1');
    expect(prisma.path.findMany).toHaveBeenCalledWith({
      where: { publisherId: 'u1' },
      include: { publisher: true },
    });
  });

  it('findFollowedByUser filters by followerIds-has', () => {
    repo.findFollowedByUser('u1');
    expect(prisma.path.findMany).toHaveBeenCalledWith({
      where: { followerIds: { has: 'u1' } },
      include: { publisher: true },
    });
  });

  it('update writes title and description only', () => {
    repo.update('p1', { title: 'T2', description: 'D2' } as any);
    const args = prisma.path.update.mock.calls[0][0];
    expect(args.data).toEqual({ title: 'T2', description: 'D2' });
  });

  it('delete removes the path by id', () => {
    repo.delete('p1');
    expect(prisma.path.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('setFollowRequests updates the followRequests array', () => {
    repo.setFollowRequests('p1', ['u2', 'u3']);
    expect(prisma.path.update.mock.calls[0][0].data.followRequests).toEqual([
      'u2',
      'u3',
    ]);
  });

  it('addFollower runs a 2-step transaction', async () => {
    await repo.addFollower('p1', 'u2');
    expect(prisma.path.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { followerIds: { push: 'u2' } },
      include: { publisher: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { followedPathIds: { push: 'p1' } },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('removeFollower runs a 2-step transaction with the new arrays', async () => {
    await repo.removeFollower('p1', 'u2', ['u3'], ['p2']);
    expect(prisma.path.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { followerIds: ['u3'] },
      include: { publisher: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { followedPathIds: ['p2'] },
    });
  });

  it('approveFollowRequest writes new arrays and pushes pathId to user', async () => {
    await repo.approveFollowRequest('p1', 'u2', [], ['u2']);
    expect(prisma.path.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { followRequests: [], followerIds: ['u2'] },
      include: { publisher: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { followedPathIds: { push: 'p1' } },
    });
  });
});

// ───────────────────────────── PathFollowersService ─────────────────────────────
describe('PathFollowersService', () => {
  let repo: any;
  let usersClient: any;
  let service: PathFollowersService;

  const path = {
    id: 'p1',
    publisherId: 'u-owner',
    followerIds: ['u-existing'],
    followRequests: [],
    publisher: { id: 'u-owner' },
  };

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      addFollower: jest.fn(),
      removeFollower: jest.fn(),
    };
    usersClient = {
      findById: jest.fn(),
      findFollowerProfilesByIds: jest.fn(),
    };
    service = new PathFollowersService(repo, usersClient);
  });

  describe('followPath', () => {
    it('adds the follower when the user is not already following', async () => {
      repo.findById.mockResolvedValue(path);
      repo.addFollower.mockResolvedValue([
        { ...path, followerIds: ['u-existing', 'u-new'] },
      ]);
      const result = await service.followPath('u-new', 'p1');
      expect(repo.addFollower).toHaveBeenCalledWith('p1', 'u-new');
      expect(result.followers).toEqual(['u-existing', 'u-new']);
    });
    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.followPath('u', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('throws when the user is already following', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(service.followPath('u-existing', 'p1')).rejects.toThrow(
        'Already following this path',
      );
    });
  });

  describe('unfollowPath', () => {
    const user = { id: 'u-existing', followedPathIds: ['p1', 'p2'] };

    it('removes the follower and the path from the user record', async () => {
      repo.findById.mockResolvedValue(path);
      usersClient.findById.mockResolvedValue(user);
      repo.removeFollower.mockResolvedValue([{ ...path, followerIds: [] }]);
      const result = await service.unfollowPath('u-existing', 'p1');
      expect(repo.removeFollower).toHaveBeenCalledWith(
        'p1',
        'u-existing',
        [],
        ['p2'],
      );
      expect(result.followers).toEqual([]);
    });
    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.unfollowPath('u', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('throws NotFoundException when the user is missing', async () => {
      repo.findById.mockResolvedValue(path);
      usersClient.findById.mockResolvedValue(null);
      await expect(service.unfollowPath('u', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getFollowersWithDetails', () => {
    it('returns the empty list early when no followers', async () => {
      repo.findById.mockResolvedValue({ ...path, followerIds: [] });
      await expect(service.getFollowersWithDetails('p1')).resolves.toEqual([]);
      expect(usersClient.findFollowerProfilesByIds).not.toHaveBeenCalled();
    });
    it('fetches full profiles for current followers', async () => {
      repo.findById.mockResolvedValue(path);
      usersClient.findFollowerProfilesByIds.mockResolvedValue([
        { id: 'u-existing' },
      ]);
      const result = await service.getFollowersWithDetails('p1');
      expect(usersClient.findFollowerProfilesByIds).toHaveBeenCalledWith([
        'u-existing',
      ]);
      expect(result).toEqual([{ id: 'u-existing' }]);
    });
    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.getFollowersWithDetails('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeFollower', () => {
    it('removes the follower and updates user.followedPathIds', async () => {
      repo.findById.mockResolvedValue(path);
      usersClient.findById.mockResolvedValue({
        id: 'u-existing',
        followedPathIds: ['p1'],
      });
      repo.removeFollower.mockResolvedValue([{ ...path, followerIds: [] }]);
      const result = await service.removeFollower('p1', 'u-existing');
      expect(repo.removeFollower).toHaveBeenCalledWith(
        'p1',
        'u-existing',
        [],
        [],
      );
      expect(result.followers).toEqual([]);
    });
    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.removeFollower('p', 'u')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('throws NotFoundException when the follower is missing', async () => {
      repo.findById.mockResolvedValue(path);
      usersClient.findById.mockResolvedValue(null);
      await expect(service.removeFollower('p1', 'u')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertPublisherCanManageFollowers', () => {
    it('passes silently when the caller is the publisher', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.assertPublisherCanManageFollowers('p1', 'u-owner'),
      ).resolves.toBeUndefined();
    });
    it('throws ForbiddenException when the caller is not the publisher', async () => {
      repo.findById.mockResolvedValue(path);
      await expect(
        service.assertPublisherCanManageFollowers('p1', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('throws NotFoundException when the path is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.assertPublisherCanManageFollowers('missing', 'u-owner'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

// ───────────────────────────── PathsController ─────────────────────────────
describe('PathsController', () => {
  let svc: any;
  let controller: PathsController;

  beforeEach(() => {
    svc = {
      createPath: jest.fn(),
      getAllPaths: jest.fn(),
      getPublishedPathsByUser: jest.fn(),
      getFollowedPathsByUser: jest.fn(),
      getPathById: jest.fn(),
      followPath: jest.fn(),
      unfollowPath: jest.fn(),
      updatePath: jest.fn(),
      deletePath: jest.fn(),
      getFollowersWithDetails: jest.fn(),
      assertPublisherCanManageFollowers: jest.fn(),
      removeFollower: jest.fn(),
    };
    controller = new PathsController(svc);
  });

  it('createPath forwards userId and dto', async () => {
    await controller.createPath('u1', { title: 'T', description: 'D' } as any);
    expect(svc.createPath).toHaveBeenCalledWith('u1', {
      title: 'T',
      description: 'D',
    });
  });

  it('getAllPaths returns the service result', async () => {
    svc.getAllPaths.mockResolvedValue(['a']);
    await expect(controller.getAllPaths()).resolves.toEqual(['a']);
  });

  it('getMyPublishedPaths uses the current user id', async () => {
    await controller.getMyPublishedPaths('u1');
    expect(svc.getPublishedPathsByUser).toHaveBeenCalledWith('u1');
  });

  it('getMyFollowedPaths uses the current user id', async () => {
    await controller.getMyFollowedPaths('u1');
    expect(svc.getFollowedPathsByUser).toHaveBeenCalledWith('u1');
  });

  it('getPathById passes the path id through', async () => {
    await controller.getPathById('p1');
    expect(svc.getPathById).toHaveBeenCalledWith('p1');
  });

  it('followPath forwards userId and pathId', async () => {
    await controller.followPath('u1', 'p1');
    expect(svc.followPath).toHaveBeenCalledWith('u1', 'p1');
  });

  it('unfollowPath forwards userId and pathId', async () => {
    await controller.unfollowPath('u1', 'p1');
    expect(svc.unfollowPath).toHaveBeenCalledWith('u1', 'p1');
  });

  it('updatePath forwards id and dto', async () => {
    await controller.updatePath('p1', { title: 'New', description: 'D' } as any);
    expect(svc.updatePath).toHaveBeenCalledWith('p1', {
      title: 'New',
      description: 'D',
    });
  });

  it('deletePath forwards id', async () => {
    await controller.deletePath('p1');
    expect(svc.deletePath).toHaveBeenCalledWith('p1');
  });

  it('getFollowers forwards path id', async () => {
    await controller.getFollowers('p1');
    expect(svc.getFollowersWithDetails).toHaveBeenCalledWith('p1');
  });

  describe('removeFollower', () => {
    it('asserts authority then deletes the follower', async () => {
      await controller.removeFollower('u-owner', 'p1', 'u-follower');
      expect(svc.assertPublisherCanManageFollowers).toHaveBeenCalledWith(
        'p1',
        'u-owner',
      );
      expect(svc.removeFollower).toHaveBeenCalledWith('p1', 'u-follower');
    });
    it('does not delete when the authority check fails', async () => {
      svc.assertPublisherCanManageFollowers.mockRejectedValue(
        new Error('forbidden'),
      );
      await expect(
        controller.removeFollower('u', 'p1', 'u-follower'),
      ).rejects.toThrow('forbidden');
      expect(svc.removeFollower).not.toHaveBeenCalled();
    });
  });
});
