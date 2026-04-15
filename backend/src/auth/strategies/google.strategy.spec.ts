import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockConfig: { [key: string]: string } = {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should have correct strategy name', () => {
    expect(strategy.name).toBe('google');
  });

  describe('validate', () => {
    it('should validate and return user profile', (done) => {
      const profile = {
        id: 'google-123',
        name: {
          givenName: 'John',
          familyName: 'Doe',
        },
        emails: [{ value: 'john@example.com' }],
        photos: [{ value: 'https://example.com/pic.jpg' }],
      };

      const doneCallback = (err: any, user: any) => {
        expect(err).toBeNull();
        expect(user).toEqual({
          googleId: 'google-123',
          email: 'john@example.com',
          name: 'John Doe',
          picture: 'https://example.com/pic.jpg',
        });
        done();
      };

      strategy.validate('accessToken', 'refreshToken', profile, doneCallback);
    });

    it('should handle missing photos', (done) => {
      const profile = {
        id: 'google-456',
        name: {
          givenName: 'Jane',
          familyName: 'Smith',
        },
        emails: [{ value: 'jane@example.com' }],
        photos: [],
      };

      const doneCallback = (err: any, user: any) => {
        expect(err).toBeNull();
        expect(user.picture).toBe('');
        done();
      };

      strategy.validate('accessToken', 'refreshToken', profile, doneCallback);
    });

    it('should handle multiple emails', (done) => {
      const profile = {
        id: 'google-789',
        name: {
          givenName: 'Bob',
          familyName: 'Johnson',
        },
        emails: [
          { value: 'bob.primary@example.com' },
          { value: 'bob.secondary@example.com' },
        ],
        photos: [{ value: 'https://example.com/bob.jpg' }],
      };

      const doneCallback = (err: any, user: any) => {
        expect(err).toBeNull();
        expect(user.email).toBe('bob.primary@example.com');
        done();
      };

      strategy.validate('accessToken', 'refreshToken', profile, doneCallback);
    });
  });
});
