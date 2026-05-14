import { HealthController } from './health.controller';

describe('HealthController', () => {
  const originalEnv = { ...process.env };
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
    process.env.SERVICE_NAME = 'auth-service';
    process.env.PORT = '4001';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns ok status with service metadata', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('auth-service');
    expect(result.port).toBe('4001');
  });

  it('produces a parseable ISO 8601 timestamp', () => {
    const result = controller.check();
    const parsed = new Date(result.timestamp);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('falls back to "unknown" when env vars are missing', () => {
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    const result = controller.check();
    expect(result.service).toBe('unknown');
    expect(result.port).toBe('unknown');
  });
});
