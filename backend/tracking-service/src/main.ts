import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const serviceName = process.env.SERVICE_NAME || 'api-gateway';
  const logger = new Logger(serviceName);
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  logger.log(`${serviceName} running on http://localhost:${port}`);
}
bootstrap();
