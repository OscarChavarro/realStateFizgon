import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: false });

  const configuration = app.get(Configuration);
  const port = configuration.apiPort;
  await app.listen(port, '0.0.0.0');

  logger.log(`propertyBackend HTTP API listening on TCP ${port}.`);
}

void bootstrap();
