import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = { sign: jest.fn(() => 'mock-token'), verify: jest.fn() };
  const mockUsersService = {
    findOrCreate: jest.fn(),
    setOnlineStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('validateToken should return null for invalid token', () => {
    mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
    const result = service.validateToken('bad-token');
    expect(result).toBeNull();
  });

  it('validateToken should return payload for valid token', () => {
    const payload = { sub: 'user-id', email: 'test@test.com' };
    mockJwtService.verify.mockReturnValue(payload);
    const result = service.validateToken('valid-token');
    expect(result).toEqual(payload);
  });
});
