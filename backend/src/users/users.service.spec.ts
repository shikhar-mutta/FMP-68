import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockUser = {
    id: '123',
    googleId: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    isOnline: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    followedPathIds: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreate', () => {
    it('should create a new user if not exists', async () => {
      const profile = {
        googleId: 'google-456',
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/new.jpg',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser as any);

      const result = await service.findOrCreate(profile);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: profile.googleId },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          isOnline: true,
          lastSeen: expect.any(Date),
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should update existing user on subsequent login', async () => {
      const profile = {
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      };

      const existingUser = { ...mockUser };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(existingUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        isOnline: true,
        lastSeen: new Date(),
      } as any);

      const result = await service.findOrCreate(profile);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: profile.googleId },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { googleId: profile.googleId },
        data: {
          isOnline: true,
          lastSeen: expect.any(Date),
          picture: profile.picture,
        },
      });
      expect(result).toBeDefined();
    });

    it('should handle missing picture in profile', async () => {
      const profile = {
        googleId: 'google-789',
        email: 'nopic@example.com',
        name: 'No Picture User',
        picture: '',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue({
        ...mockUser,
        googleId: profile.googleId,
        picture: '',
      } as any);

      const result = await service.findOrCreate(profile);

      expect(result).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.findById(mockUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('setOnlineStatus', () => {
    it('should set user online', async () => {
      const onlineUser = { ...mockUser, isOnline: true };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(onlineUser as any);

      const result = await service.setOnlineStatus(mockUser.id, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isOnline: true, lastSeen: expect.any(Date) },
      });
      expect(result.isOnline).toBe(true);
    });

    it('should set user offline', async () => {
      const offlineUser = { ...mockUser, isOnline: false };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(offlineUser as any);

      const result = await service.setOnlineStatus(mockUser.id, false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isOnline: false, lastSeen: expect.any(Date) },
      });
      expect(result.isOnline).toBe(false);
    });

    it('should update lastSeen timestamp', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        lastSeen: new Date(),
      } as any);

      await service.setOnlineStatus(mockUser.id, true);

      const callArgs = (prisma.user.update as jest.Mock).mock.calls[0];
      expect(callArgs[0].data.lastSeen).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return all users sorted by online status then name', async () => {
      const users = [
        { ...mockUser, isOnline: true, name: 'Alice' },
        { ...mockUser, isOnline: true, name: 'Bob' },
        { ...mockUser, isOnline: false, name: 'Charlie' },
      ];

      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users as any);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
      });
      expect(result).toEqual(users);
    });

    it('should return empty array when no users exist', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should return users with correct sorting order', async () => {
      const onlineAlice = { ...mockUser, isOnline: true, name: 'Alice' };
      const onlineBob = { ...mockUser, isOnline: true, name: 'Bob' };
      const offlineCharlie = { ...mockUser, isOnline: false, name: 'Charlie' };

      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([onlineAlice, onlineBob, offlineCharlie] as any);

      const result = await service.findAll();

      expect(result[0].isOnline).toBe(true);
      expect(result[result.length - 1].isOnline).toBe(false);
    });
  });
});
