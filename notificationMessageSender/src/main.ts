import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configuration = app.get(Configuration);

  await app.listen(configuration.metricsHttpPort, '0.0.0.0');
  Logger.log(`HTTP metrics server listening on port ${configuration.metricsHttpPort}.`, 'Bootstrap');
}

void bootstrap();
