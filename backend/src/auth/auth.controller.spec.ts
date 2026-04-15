import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockAccessToken = 'mock.jwt.token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            loginWithGoogle: jest.fn(),
            signOut: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleLogin', () => {
    it('should handle Google login (passport handled)', () => {
      expect(controller.googleLogin()).toBeUndefined();
    });
  });

  describe('googleCallback', () => {
    it('should redirect to frontend with token', async () => {
      const mockRes = {
        redirect: jest.fn(),
      } as unknown as Response;

      jest.spyOn(authService, 'loginWithGoogle').mockResolvedValue({
        accessToken: mockAccessToken,
        user: mockUser as any,
      });

      await controller.googleCallback({ user: mockUser }, mockRes);

      expect(authService.loginWithGoogle).toHaveBeenCalledWith(mockUser);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        `http://localhost:3000/auth/callback?token=${mockAccessToken}`,
      );
    });

    it('should use default frontend URL if not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);

      const mockRes = {
        redirect: jest.fn(),
      } as unknown as Response;

      jest.spyOn(authService, 'loginWithGoogle').mockResolvedValue({
        accessToken: mockAccessToken,
        user: mockUser as any,
      });

      await controller.googleCallback({ user: mockUser }, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('localhost:3000'));
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      jest.spyOn(authService, 'signOut').mockResolvedValue({
        message: 'Signed out successfully',
      });

      const result = await controller.signOut({ user: { id: mockUser.id } });

      expect(authService.signOut).toHaveBeenCalledWith(mockUser.id);
      expect(result.message).toBe('Signed out successfully');
    });
  });

  describe('getMe', () => {
    it('should return authenticated user', () => {
      const result = controller.getMe({ user: mockUser });

      expect(result).toEqual(mockUser);
    });
  });
});
