import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configuration = app.get(Configuration);
  await app.listen(configuration.apiHttpPort, '0.0.0.0');
  logger.log(`HTTP API endpoints are available on TCP port ${configuration.apiHttpPort}.`);
}

void bootstrap();
