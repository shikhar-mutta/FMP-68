import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { UsersClientService } from './users-client.service';
import { of, throwError } from 'rxjs';

// ── from auth.service.spec.ts ──
describe('AuthService', () => {
  let usersClient: jest.Mocked<UsersClientService>;
  let jwt: jest.Mocked<JwtService>;
  let service: AuthService;

  const googleUser = {
    googleId: 'g-1',
    email: 'a@b.com',
    name: 'Alice',
    picture: 'http://img/a.png',
  };

  const dbUser = { id: 'u-1', email: 'a@b.com', name: 'Alice' };

  beforeEach(() => {
    usersClient = {
      findOrCreate: jest.fn(),
    } as unknown as jest.Mocked<UsersClientService>;

    jwt = {
      sign: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(usersClient, jwt);
  });

  it('forwards the Google profile to users-service findOrCreate', async () => {
    usersClient.findOrCreate.mockResolvedValue(dbUser);
    jwt.sign.mockReturnValue('signed.jwt.token');

    await service.loginWithGoogle(googleUser);

    expect(usersClient.findOrCreate).toHaveBeenCalledWith({
      googleId: 'g-1',
      email: 'a@b.com',
      name: 'Alice',
      picture: 'http://img/a.png',
    });
  });

  it('signs a JWT carrying user id (sub) and email', async () => {
    usersClient.findOrCreate.mockResolvedValue(dbUser);
    jwt.sign.mockReturnValue('signed.jwt.token');

    await service.loginWithGoogle(googleUser);

    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'u-1',
      email: 'a@b.com',
    });
  });

  it('returns accessToken and the resolved user', async () => {
    usersClient.findOrCreate.mockResolvedValue(dbUser);
    jwt.sign.mockReturnValue('signed.jwt.token');

    const result = await service.loginWithGoogle(googleUser);

    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: dbUser,
    });
  });

  it('propagates errors from users-service', async () => {
    usersClient.findOrCreate.mockRejectedValue(new Error('upstream-down'));
    await expect(service.loginWithGoogle(googleUser)).rejects.toThrow(
      'upstream-down',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});

// ── from auth.controller.spec.ts ──
describe('AuthController', () => {
  let authService: any;
  let usersClient: any;
  let config: any;
  let controller: AuthController;

  beforeEach(() => {
    authService = { loginWithGoogle: jest.fn() };
    usersClient = { findById: jest.fn(), setOnlineStatus: jest.fn() };
    config = { get: jest.fn() };
    controller = new AuthController(authService, usersClient, config);
  });

  describe('googleCallback', () => {
    it('redirects to the frontend with the token query param', async () => {
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'tok',
        user: { id: 'u1' },
      });
      config.get.mockReturnValue('http://frontend');
      const res = { redirect: jest.fn() };

      await controller.googleCallback({ user: { googleId: 'g' } } as any, res as any);

      expect(authService.loginWithGoogle).toHaveBeenCalledWith({
        googleId: 'g',
      });
      expect(res.redirect).toHaveBeenCalledWith(
        'http://frontend/auth/callback?token=tok',
      );
    });

    it('falls back to localhost when FRONTEND_URL is unset', async () => {
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'tok',
        user: { id: 'u1' },
      });
      config.get.mockReturnValue(undefined);
      const res = { redirect: jest.fn() };

      await controller.googleCallback({ user: {} } as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?token=tok',
      );
    });
  });

  describe('getMe', () => {
    it('returns the user from users-service', async () => {
      const user = { id: 'u1' };
      usersClient.findById.mockResolvedValue(user);
      await expect(controller.getMe('u1')).resolves.toBe(user);
      expect(usersClient.findById).toHaveBeenCalledWith('u1');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      usersClient.findById.mockResolvedValue(null);
      await expect(controller.getMe('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('signOut', () => {
    it('marks the user offline and returns the success message', async () => {
      usersClient.setOnlineStatus.mockResolvedValue({ id: 'u1' });
      const result = await controller.signOut('u1');
      expect(usersClient.setOnlineStatus).toHaveBeenCalledWith('u1', false);
      expect(result).toEqual({ message: 'Signed out successfully' });
    });
  });

  describe('googleLogin', () => {
    it('is a passport-managed redirect (no body)', () => {
      expect(controller.googleLogin()).toBeUndefined();
    });
  });
});

// ── from users-client.service.spec.ts ──
const makeHttp = () => ({
  get: jest.fn(),
  post: jest.fn(),
});

const makeConfig = (url?: string) => ({
  get: jest.fn().mockReturnValue(url),
});

describe('UsersClientService', () => {
  let http: ReturnType<typeof makeHttp>;
  let service: UsersClientService;

  beforeEach(() => {
    http = makeHttp();
    service = new UsersClientService(
      http as any,
      makeConfig('http://users:4002') as any,
    );
  });

  describe('findOrCreate', () => {
    it('POSTs the profile to the users-service find-or-create endpoint', async () => {
      http.post.mockReturnValue(of({ data: { id: 'u1' } }));
      const result = await service.findOrCreate({
        googleId: 'g',
        email: 'a@b.com',
        name: 'A',
        picture: 'p',
      });
      expect(http.post).toHaveBeenCalledWith(
        'http://users:4002/internal/users/find-or-create',
        { googleId: 'g', email: 'a@b.com', name: 'A', picture: 'p' },
      );
      expect(result).toEqual({ id: 'u1' });
    });

    it('throws ServiceUnavailableException when the call fails', async () => {
      http.post.mockReturnValue(throwError(() => new Error('boom')));
      await expect(
        service.findOrCreate({
          googleId: 'g',
          email: 'a@b.com',
          name: 'A',
          picture: 'p',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('findById', () => {
    it('GETs the user by id', async () => {
      http.get.mockReturnValue(of({ data: { id: 'u1' } }));
      const result = await service.findById('u1');
      expect(http.get).toHaveBeenCalledWith(
        'http://users:4002/internal/users/u1',
      );
      expect(result).toEqual({ id: 'u1' });
    });

    it('returns null when the upstream call fails', async () => {
      http.get.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.findById('u1')).resolves.toBeNull();
    });
  });

  describe('setOnlineStatus', () => {
    it('POSTs the online-status update', async () => {
      http.post.mockReturnValue(of({ data: { id: 'u1', isOnline: false } }));
      const result = await service.setOnlineStatus('u1', false);
      expect(http.post).toHaveBeenCalledWith(
        'http://users:4002/internal/users/u1/online-status',
        { isOnline: false },
      );
      expect(result).toEqual({ id: 'u1', isOnline: false });
    });

    it('returns null when the upstream call fails', async () => {
      http.post.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.setOnlineStatus('u1', true)).resolves.toBeNull();
    });
  });

  describe('config fallback', () => {
    it('falls back to localhost when USERS_SERVICE_URL is not configured', async () => {
      const localService = new UsersClientService(
        http as any,
        makeConfig(undefined) as any,
      );
      http.get.mockReturnValue(of({ data: 'x' }));
      await localService.findById('u1');
      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:4002/internal/users/u1',
      );
    });
  });

  describe('error coalescence (err?.message ?? err)', () => {
    it('handles non-Error thrown values in findOrCreate', async () => {
      http.post.mockReturnValue(throwError(() => 'plain-string-error'));
      await expect(
        service.findOrCreate({
          googleId: 'g',
          email: 'a@b.com',
          name: 'A',
          picture: 'p',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('handles non-Error thrown values in findById', async () => {
      http.get.mockReturnValue(throwError(() => 'plain-string-error'));
      await expect(service.findById('u1')).resolves.toBeNull();
    });

    it('handles non-Error thrown values in setOnlineStatus', async () => {
      http.post.mockReturnValue(throwError(() => 'plain-string-error'));
      await expect(service.setOnlineStatus('u1', true)).resolves.toBeNull();
    });
  });
});
