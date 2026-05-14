import { HealthController } from './health.controller';

describe('HealthController (paths-service)', () => {
  const originalEnv = { ...process.env };
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
    process.env.SERVICE_NAME = 'paths-service';
    process.env.PORT = '4003';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns ok status with service metadata', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('paths-service');
    expect(result.port).toBe('4003');
  });

  it('falls back to "unknown" when env vars are missing', () => {
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    const result = controller.check();
    expect(result.service).toBe('unknown');
    expect(result.port).toBe('unknown');
  });
});
