import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const serviceName = process.env.SERVICE_NAME || 'api-gateway';
  const logger = new Logger(serviceName);
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port);
  logger.log(`${serviceName} running on http://localhost:${port}`);
}
bootstrap();
