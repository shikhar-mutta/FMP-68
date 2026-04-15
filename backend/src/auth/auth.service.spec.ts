import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

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

  const mockJwtToken = 'mock.jwt.token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOrCreate: jest.fn(),
            setOnlineStatus: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loginWithGoogle', () => {
    it('should create user and return access token on first login', async () => {
      const googleProfile = {
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      };

      jest.spyOn(usersService, 'findOrCreate').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockJwtToken);

      const result = await service.loginWithGoogle(googleProfile);

      expect(usersService.findOrCreate).toHaveBeenCalledWith(googleProfile);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      });
      expect(result).toEqual({
        accessToken: mockJwtToken,
        user: mockUser,
      });
    });

    it('should update user and return access token on subsequent login', async () => {
      const googleProfile = {
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      };

      const updatedUser = {
        ...mockUser,
        lastSeen: new Date(),
        isOnline: true,
      };

      jest.spyOn(usersService, 'findOrCreate').mockResolvedValue(updatedUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockJwtToken);

      const result = await service.loginWithGoogle(googleProfile);

      expect(usersService.findOrCreate).toHaveBeenCalledWith(googleProfile);
      expect(result.accessToken).toBe(mockJwtToken);
    });
  });

  describe('signOut', () => {
    it('should set user online status to false and return success message', async () => {
      jest.spyOn(usersService, 'setOnlineStatus').mockResolvedValue({
        ...mockUser,
        isOnline: false,
      } as any);

      const result = await service.signOut(mockUser.id);

      expect(usersService.setOnlineStatus).toHaveBeenCalledWith(mockUser.id, false);
      expect(result).toEqual({ message: 'Signed out successfully' });
    });

    it('should handle errors when setting offline status fails', async () => {
      const error = new Error('Database error');
      jest.spyOn(usersService, 'setOnlineStatus').mockRejectedValue(error);

      await expect(service.signOut(mockUser.id)).rejects.toThrow('Database error');
    });
  });

  describe('validateToken', () => {
    it('should return decoded token data for valid token', () => {
      const tokenData = {
        sub: mockUser.id,
        email: mockUser.email,
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(tokenData);

      const result = service.validateToken(mockJwtToken);

      expect(jwtService.verify).toHaveBeenCalledWith(mockJwtToken);
      expect(result).toEqual(tokenData);
    });

    it('should return null for invalid token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = service.validateToken('invalid.token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = service.validateToken('expired.token');

      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Malformed token');
      });

      const result = service.validateToken('malformed');

      expect(result).toBeNull();
    });
  });
});
