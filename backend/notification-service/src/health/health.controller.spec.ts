import { HealthController } from './health.controller';

describe('HealthController (notification-service)', () => {
  const originalEnv = { ...process.env };
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
    process.env.SERVICE_NAME = 'notification-service';
    process.env.PORT = '4005';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns ok status with service metadata', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('notification-service');
    expect(result.port).toBe('4005');
    expect(typeof result.timestamp).toBe('string');
    expect(() => new Date(result.timestamp)).not.toThrow();
  });

  it('falls back to "unknown" when env vars are missing', () => {
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    const result = controller.check();
    expect(result.service).toBe('unknown');
    expect(result.port).toBe('unknown');
  });
});
