import { GoogleProfile } from './users.types';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersInternalController } from './users-internal.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

// ── from users.service.spec.ts ──
describe('UsersService', () => {
  let repo: jest.Mocked<UsersRepository>;
  let service: UsersService;

  const profile: GoogleProfile = {
    googleId: 'g-123',
    email: 'a@b.com',
    name: 'Alice',
    picture: 'http://img/a.png',
  };

  const existingUser = {
    id: 'u1',
    googleId: 'g-123',
    email: 'a@b.com',
    name: 'Alice',
    picture: 'http://img/old.png',
    isOnline: false,
    lastSeen: new Date('2024-01-01T00:00:00Z'),
  } as any;

  beforeEach(() => {
    repo = {
      findByGoogleId: jest.fn(),
      createFromGoogleProfile: jest.fn(),
      markSeenOnline: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
      findFollowerProfilesByIds: jest.fn(),
      updateOnlineStatus: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repo);
  });

  describe('findOrCreate', () => {
    it('creates a new user when none exists for googleId', async () => {
      repo.findByGoogleId.mockResolvedValue(null);
      const created = { ...existingUser, picture: profile.picture };
      repo.createFromGoogleProfile.mockResolvedValue(created);

      const result = await service.findOrCreate(profile);

      expect(repo.findByGoogleId).toHaveBeenCalledWith('g-123');
      expect(repo.createFromGoogleProfile).toHaveBeenCalledWith(profile);
      expect(repo.markSeenOnline).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('marks existing user online and updates picture from profile', async () => {
      repo.findByGoogleId.mockResolvedValue(existingUser);
      repo.markSeenOnline.mockResolvedValue({
        ...existingUser,
        picture: profile.picture,
      });

      await service.findOrCreate(profile);

      expect(repo.markSeenOnline).toHaveBeenCalledWith('g-123', profile.picture);
      expect(repo.createFromGoogleProfile).not.toHaveBeenCalled();
    });

    it('keeps existing picture when profile.picture is empty', async () => {
      repo.findByGoogleId.mockResolvedValue(existingUser);
      repo.markSeenOnline.mockResolvedValue(existingUser);

      await service.findOrCreate({ ...profile, picture: '' });

      expect(repo.markSeenOnline).toHaveBeenCalledWith(
        'g-123',
        existingUser.picture,
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('returns user when found', async () => {
      repo.findById.mockResolvedValue(existingUser);
      await expect(service.findByIdOrThrow('u1')).resolves.toBe(existingUser);
    });

    it('throws NotFoundException when user is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delegating methods', () => {
    it('findById delegates to repository', async () => {
      repo.findById.mockResolvedValue(existingUser);
      await expect(service.findById('u1')).resolves.toBe(existingUser);
      expect(repo.findById).toHaveBeenCalledWith('u1');
    });

    it('findManyByIds delegates to repository', async () => {
      repo.findManyByIds.mockResolvedValue([existingUser]);
      await expect(service.findManyByIds(['u1'])).resolves.toEqual([
        existingUser,
      ]);
      expect(repo.findManyByIds).toHaveBeenCalledWith(['u1']);
    });

    it('setOnlineStatus delegates to repository', async () => {
      repo.updateOnlineStatus.mockResolvedValue(existingUser);
      await service.setOnlineStatus('u1', true);
      expect(repo.updateOnlineStatus).toHaveBeenCalledWith('u1', true);
    });

    it('findAll delegates to repository', async () => {
      repo.findAll.mockResolvedValue([existingUser]);
      await expect(service.findAll()).resolves.toEqual([existingUser]);
    });

    it('findFollowerProfilesByIds delegates to repository', async () => {
      const profiles = [{ id: 'u1', name: 'Alice' }];
      repo.findFollowerProfilesByIds.mockResolvedValue(profiles as any);
      await expect(
        service.findFollowerProfilesByIds(['u1']),
      ).resolves.toEqual(profiles);
      expect(repo.findFollowerProfilesByIds).toHaveBeenCalledWith(['u1']);
    });
  });
});

// ── from users.repository.spec.ts ──
describe('UsersRepository', () => {
  let prisma: any;
  let repo: UsersRepository;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    repo = new UsersRepository(prisma);
  });

  it('findByGoogleId calls prisma.user.findUnique with googleId', () => {
    repo.findByGoogleId('g-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { googleId: 'g-1' },
    });
  });

  it('createFromGoogleProfile maps profile fields and sets isOnline=true', () => {
    repo.createFromGoogleProfile({
      googleId: 'g-1',
      email: 'a@b.com',
      name: 'Alice',
      picture: 'p',
    });
    const args = prisma.user.create.mock.calls[0][0];
    expect(args.data.googleId).toBe('g-1');
    expect(args.data.email).toBe('a@b.com');
    expect(args.data.name).toBe('Alice');
    expect(args.data.picture).toBe('p');
    expect(args.data.isOnline).toBe(true);
    expect(args.data.lastSeen).toBeInstanceOf(Date);
  });

  it('createFromGoogleProfile defaults picture to empty string', () => {
    repo.createFromGoogleProfile({
      googleId: 'g-1',
      email: 'a@b.com',
      name: 'Alice',
      picture: undefined as any,
    });
    expect(prisma.user.create.mock.calls[0][0].data.picture).toBe('');
  });

  it('markSeenOnline sets isOnline, lastSeen and picture', () => {
    repo.markSeenOnline('g-1', 'new-pic');
    const args = prisma.user.update.mock.calls[0][0];
    expect(args.where).toEqual({ googleId: 'g-1' });
    expect(args.data.isOnline).toBe(true);
    expect(args.data.lastSeen).toBeInstanceOf(Date);
    expect(args.data.picture).toBe('new-pic');
  });

  it('findById uses id as where clause', () => {
    repo.findById('u-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u-1' },
    });
  });

  it('findManyByIds filters by id-in list', () => {
    repo.findManyByIds(['u1', 'u2']);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
    });
  });

  it('findFollowerProfilesByIds selects only public profile fields', () => {
    repo.findFollowerProfilesByIds(['u1']);
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: { in: ['u1'] } });
    expect(args.select).toEqual({
      id: true,
      name: true,
      email: true,
      picture: true,
    });
  });

  it('updateOnlineStatus stamps lastSeen and isOnline', () => {
    repo.updateOnlineStatus('u-1', false);
    const args = prisma.user.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'u-1' });
    expect(args.data.isOnline).toBe(false);
    expect(args.data.lastSeen).toBeInstanceOf(Date);
  });

  it('findAll sorts by isOnline desc then name asc', () => {
    repo.findAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
    });
  });
});

// ── from users.controller.spec.ts ──
describe('UsersController', () => {
  let svc: jest.Mocked<UsersService>;
  let controller: UsersController;

  beforeEach(() => {
    svc = {
      findAll: jest.fn(),
      findByIdOrThrow: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    controller = new UsersController(svc);
  });

  it('getAllUsers returns the full list from the service', async () => {
    const users = [{ id: 'u1' }];
    svc.findAll.mockResolvedValue(users as any);
    await expect(controller.getAllUsers('u1')).resolves.toBe(users);
    expect(svc.findAll).toHaveBeenCalledTimes(1);
  });

  it('getMe resolves the current user by id', async () => {
    const user = { id: 'u1' };
    svc.findByIdOrThrow.mockResolvedValue(user as any);
    await expect(controller.getMe('u1')).resolves.toBe(user);
    expect(svc.findByIdOrThrow).toHaveBeenCalledWith('u1');
  });
});

// ── from users-internal.controller.spec.ts ──
describe('UsersInternalController', () => {
  let svc: jest.Mocked<UsersService>;
  let controller: UsersInternalController;

  beforeEach(() => {
    svc = {
      findOrCreate: jest.fn(),
      findByIdOrThrow: jest.fn(),
      findManyByIds: jest.fn(),
      findFollowerProfilesByIds: jest.fn(),
      setOnlineStatus: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    controller = new UsersInternalController(svc);
  });

  it('findOrCreate forwards the profile to the service', () => {
    const profile = {
      googleId: 'g',
      email: 'a@b.com',
      name: 'A',
      picture: '',
    };
    controller.findOrCreate(profile);
    expect(svc.findOrCreate).toHaveBeenCalledWith(profile);
  });

  it('findById resolves a user by id', () => {
    controller.findById('u-1');
    expect(svc.findByIdOrThrow).toHaveBeenCalledWith('u-1');
  });

  it('findManyByIds passes the ids array through', () => {
    controller.findManyByIds({ ids: ['u1', 'u2'] });
    expect(svc.findManyByIds).toHaveBeenCalledWith(['u1', 'u2']);
  });

  it('findManyByIds tolerates a missing body (defaults to empty array)', () => {
    controller.findManyByIds({} as any);
    expect(svc.findManyByIds).toHaveBeenCalledWith([]);
  });

  it('findFollowerProfilesByIds passes the ids array through', () => {
    controller.findFollowerProfilesByIds({ ids: ['u1'] });
    expect(svc.findFollowerProfilesByIds).toHaveBeenCalledWith(['u1']);
  });

  it('findFollowerProfilesByIds tolerates a missing body', () => {
    controller.findFollowerProfilesByIds({} as any);
    expect(svc.findFollowerProfilesByIds).toHaveBeenCalledWith([]);
  });

  it('setOnlineStatus coerces the flag to a boolean', () => {
    controller.setOnlineStatus('u-1', { isOnline: 1 as any });
    expect(svc.setOnlineStatus).toHaveBeenCalledWith('u-1', true);

    controller.setOnlineStatus('u-1', { isOnline: undefined as any });
    expect(svc.setOnlineStatus).toHaveBeenLastCalledWith('u-1', false);
  });
});
