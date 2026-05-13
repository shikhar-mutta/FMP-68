import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.use(
  '/auth',
  createProxyMiddleware({
    target: 'http://auth-service:3001',
    changeOrigin: true,
    pathRewrite: {
      '^/auth': '/auth',
    },
  }),
);

  // PATHS
  app.use(
    '/paths',
    createProxyMiddleware({
      target: 'http://path-service:3002',
      changeOrigin: true,
    }),
  );

  // FOLLOW REQUESTS
  app.use(
    '/follow-requests',
    createProxyMiddleware({
      target: 'http://follow-request-service:3003',
      changeOrigin: true,
    }),
  );

  await app.listen(3000);

  console.log('gateway-service running on 3000');
}

bootstrap();