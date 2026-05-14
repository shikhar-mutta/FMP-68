import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    controller = new HealthController();
    process.env.SERVICE_NAME = 'users-service';
    process.env.PORT = '4002';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns status ok with service metadata', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('users-service');
    expect(result.port).toBe('4002');
    expect(typeof result.timestamp).toBe('string');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });

  it('falls back to "unknown" when env vars are missing', () => {
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    const result = controller.check();
    expect(result.service).toBe('unknown');
    expect(result.port).toBe('unknown');
  });
});
