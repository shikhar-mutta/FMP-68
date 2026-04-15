import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    id: 'user-123',
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
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [mockUser];
      jest.spyOn(usersService, 'findAll').mockResolvedValue(mockUsers as any);

      const result = await controller.getAllUsers();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when no users exist', async () => {
      jest.spyOn(usersService, 'findAll').mockResolvedValue([]);

      const result = await controller.getAllUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getMe', () => {
    it('should return current authenticated user', async () => {
      const result = await controller.getMe({ user: mockUser });

      expect(result).toEqual(mockUser);
    });

    it('should work with different user data', async () => {
      const differentUser = { ...mockUser, id: 'user-456', name: 'Different User' };

      const result = await controller.getMe({ user: differentUser });

      expect(result).toEqual(differentUser);
    });
  });
});
