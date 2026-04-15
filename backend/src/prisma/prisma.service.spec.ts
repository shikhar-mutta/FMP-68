import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize without errors', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined as any);
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
      connectSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect without errors', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined as any);
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    });
  });
});
