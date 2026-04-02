import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS — allow React dev server
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 FMP-68 Backend running on http://localhost:${port}`);
}
bootstrap();
