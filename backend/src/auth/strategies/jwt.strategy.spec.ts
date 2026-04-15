import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let usersService: UsersService;

  const mockJwtSecret = 'test-jwt-secret-key';
  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    googleId: 'google-123',
    picture: 'https://example.com/photo.jpg',
    isOnline: true,
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    followedPathIds: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return mockJwtSecret;
              }
              return undefined;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should have correct strategy name', () => {
    expect(strategy.name).toBe('jwt');
  });

  describe('validate', () => {
    it('should validate and return user from access token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);

      const result = await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith('user-123');
      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should validate payload with additional fields', async () => {
      const payload = {
        sub: 'user-456',
        email: 'user@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
      };

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);

      const result = await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith('user-456');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload = {
        sub: 'nonexistent',
        email: 'nonexistent@example.com',
      };

      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow('User not found');
      expect(usersService.findById).toHaveBeenCalledWith('nonexistent');
    });
  });
});
