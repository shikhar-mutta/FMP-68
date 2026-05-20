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

  // Socket.io proxy — Socket.io always uses the /socket.io path regardless of namespace.
  // The frontend connects via `io('http://localhost:4000/tracking')` but the
  // underlying HTTP/WebSocket requests hit /socket.io/* — proxy them to tracking-service.
  const trackingTarget =
    process.env.TRACKING_SERVICE_URL || 'http://localhost:4004';
  const socketIoProxy = createProxyMiddleware({
    target: trackingTarget,
    changeOrigin: true,
    ws: true,
    // Express's app.use('/socket.io', ...) strips the prefix before the proxy sees it.
    // Prepend it back so the request hits tracking-service at /socket.io/...
    pathRewrite: (incomingPath: string) => `/socket.io${incomingPath}`,
    on: {
      error: (err: any, _req: any, res: any) => {
        logger.error(`Socket.io proxy → ${trackingTarget} failed: ${err?.message}`);
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502);
          res.end();
        }
      },
    },
  });
  expressInstance.use('/socket.io', socketIoProxy);
  logger.log(`Socket.io proxy mounted: /socket.io/* → ${trackingTarget}`);

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);

  const httpServer = app.getHttpServer();
  // WebSocket upgrade handler — forward /socket.io upgrades to tracking-service
  httpServer.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url?.startsWith('/socket.io')) {
      (socketIoProxy as any).upgrade(req, socket, head);
    }
  });

  logger.log(`${serviceName} listening on http://localhost:${port}`);
}
bootstrap();
