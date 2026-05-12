import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // AUTH
  app.use(
  '/auth',
  createProxyMiddleware({
    target: 'http://localhost:3001/auth',
    changeOrigin: true,
  }),
);

  // PATHS
  app.use(
    '/paths',
    createProxyMiddleware({
      target: 'http://localhost:3002/paths',
      changeOrigin: true,
    }),
  );

  // FOLLOW REQUESTS
  app.use(
    '/follow-requests',
    createProxyMiddleware({
      target: 'http://localhost:3003/follow-requests',
      changeOrigin: true,
    }),
  );

  await app.listen(4000);

  console.log('gateway-service running on 4000');
}

bootstrap();