import { Logger } from '@nestjs/common';

// Silence NestJS Logger output during tests. Several services
// intentionally exercise error branches that call `logger.error(...)`
// — the assertions check the public behaviour (return value /
// exception), not the log call itself. Disabling the logger keeps
// the test output clean without affecting test correctness.
Logger.overrideLogger(false);
