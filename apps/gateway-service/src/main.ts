import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.use(
  createProxyMiddleware({
    pathFilter: '/auth',
    target: 'http://auth-service:3001',
    changeOrigin: true,
  }),
);
app.use(
  createProxyMiddleware({
    pathFilter: '/users',
    target: 'http://auth-service:3001',
    changeOrigin: true,
  }),
);
app.use(
  createProxyMiddleware({
    pathFilter: '/paths',
    target: 'http://path-service:3002',
    changeOrigin: true,
  }),
);

  // FOLLOW REQUESTS
app.use(
  createProxyMiddleware({
    pathFilter: '/follow-requests',
    target: 'http://follow-request-service:3003',
    changeOrigin: true,
  }),
);
  await app.listen(3000);

  console.log('gateway-service running on 3000');
}

bootstrap();