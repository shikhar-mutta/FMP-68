import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { buildJwtMiddleware } from './middleware/jwt.middleware';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const serviceName = process.env.SERVICE_NAME || 'api-gateway';
  const logger = new Logger(serviceName);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();

  const jwtSecret =
    process.env.JWT_SECRET || 'default-secret-key';

  expressInstance.use(buildJwtMiddleware(jwtSecret));

  // ── Proxy targets ─────────────────────────────────────────────────
  // /paths, /follow-requests, /notifications are handled directly by
  // this service (merged from paths-service) — no proxy needed.
  const routes = [
    { path: '/auth', target: process.env.AUTH_SERVICE_URL || 'http://localhost:4001' },
    { path: '/users', target: process.env.USERS_SERVICE_URL || 'http://localhost:4002' },
  ];

  for (const { path, target } of routes) {
    expressInstance.use(
      path,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (incomingPath: string) => `${path}${incomingPath}`,
        on: {
          error: (err: any, _req: any, res: any) => {
            logger.error(`Proxy ${path} → ${target} failed: ${err?.message}`);
            if (res && !res.headersSent) {
              res.statusCode = 502;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: 'bad_gateway', detail: err?.message }));
            }
          },
        },
      }),
    );
    logger.log(`Proxy mounted: ${path}/* → ${target}`);
  }

  // Socket.io is handled directly by the embedded TrackingGateway — no proxy needed.

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  logger.log(`${serviceName} listening on http://localhost:${port}`);
}
bootstrap();
