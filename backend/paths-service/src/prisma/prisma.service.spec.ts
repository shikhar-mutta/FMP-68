import { PrismaService } from './prisma.service';

describe('PrismaService (paths-service)', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
    (service as any).$connect = jest.fn().mockResolvedValue(undefined);
    (service as any).$disconnect = jest.fn().mockResolvedValue(undefined);
  });

  it('onModuleInit connects', async () => {
    await service.onModuleInit();
    expect((service as any).$connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy disconnects', async () => {
    await service.onModuleDestroy();
    expect((service as any).$disconnect).toHaveBeenCalledTimes(1);
  });
});
