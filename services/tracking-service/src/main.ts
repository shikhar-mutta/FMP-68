import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('TrackingService');
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', credentials: true });
  const port = process.env.PORT || 4003;
  await app.listen(port);
  logger.log(`📡 Tracking Service running on http://localhost:${port}`);
}
bootstrap();
