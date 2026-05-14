import 'reflect-metadata';
import { HealthController } from './health.controller';

describe('HealthController (api-gateway)', () => {
  const originalEnv = { ...process.env };
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
    process.env.SERVICE_NAME = 'api-gateway';
    process.env.PORT = '4000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns ok status with service metadata', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api-gateway');
    expect(result.port).toBe('4000');
  });

  it('produces a parseable ISO 8601 timestamp', () => {
    const result = controller.check();
    expect(Number.isNaN(new Date(result.timestamp).getTime())).toBe(false);
  });

  it('falls back to "unknown" when env vars are missing', () => {
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    const result = controller.check();
    expect(result.service).toBe('unknown');
    expect(result.port).toBe('unknown');
  });

  it('refreshes the timestamp on every call', async () => {
    const a = controller.check().timestamp;
    await new Promise((r) => setTimeout(r, 5));
    const b = controller.check().timestamp;
    expect(a).not.toBe(b);
  });
});
