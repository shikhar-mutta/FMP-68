import * as express from 'express';
import * as http from 'http';
import { legacyCreateProxyMiddleware } from 'http-proxy-middleware';

const log = (msg: string) => console.log(`[ApiGateway] ${new Date().toISOString()} ${msg}`);

async function bootstrap() {
  const app = express();

  const authServiceUrl     = process.env.AUTH_SERVICE_URL     || 'http://localhost:4001';
  const userServiceUrl     = process.env.USER_SERVICE_URL     || 'http://localhost:4002';
  const pathsServiceUrl    = process.env.PATHS_SERVICE_URL    || 'http://localhost:4003';
  const followServiceUrl   = process.env.FOLLOW_SERVICE_URL   || 'http://localhost:4004';
  const trackingServiceUrl = process.env.TRACKING_SERVICE_URL || 'http://localhost:4005';
  const frontendUrl        = process.env.FRONTEND_URL         || 'http://localhost:3000';

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && [frontendUrl, 'http://localhost:3000'].includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // ── Health (must come before proxy middleware) ─────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      services: { auth: authServiceUrl, users: userServiceUrl, paths: pathsServiceUrl, follow: followServiceUrl, tracking: trackingServiceUrl },
    });
  });

  // ── Proxy helper (uses legacy v2-compatible API) ───────────────────────────
  const proxy = (target: string) =>
    legacyCreateProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
      onError: (err: any, _req: any, res: any) => {
        log(`Proxy error → ${target}: ${err.message}`);
        if (!res.headersSent) (res as any).status(502).json({ message: 'Service unavailable' });
      },
    } as any);

  // ── Route → Service ───────────────────────────────────────────────────────
  app.use('/auth',            proxy(authServiceUrl));
  app.use('/users',           proxy(userServiceUrl));
  app.use('/paths',           proxy(pathsServiceUrl));
  app.use('/follow-requests', proxy(followServiceUrl));

  const trackingProxy = legacyCreateProxyMiddleware({
    target: trackingServiceUrl,
    changeOrigin: true,
    ws: true,
    logLevel: 'warn',
  } as any);

  app.use('/tracking',  trackingProxy);
  app.use('/socket.io', legacyCreateProxyMiddleware({ target: trackingServiceUrl, changeOrigin: true, ws: true } as any));

  // ── Start ─────────────────────────────────────────────────────────────────
  const port   = parseInt(process.env.PORT || '4000', 10);
  const server = http.createServer(app);

  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url?.startsWith('/tracking') || req.url?.startsWith('/socket.io')) {
      (trackingProxy as any).upgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    log(`🚀 API Gateway running on http://localhost:${port}`);
    log(`   /auth            → ${authServiceUrl}`);
    log(`   /users           → ${userServiceUrl}`);
    log(`   /paths           → ${pathsServiceUrl}`);
    log(`   /follow-requests → ${followServiceUrl}`);
    log(`   /tracking        → ${trackingServiceUrl}`);
  });
}

bootstrap();
