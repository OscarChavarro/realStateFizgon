import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { ScraperConfig } from 'src/infrastructure/config/scraper.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const scraperConfig = app.get(ScraperConfig);
  await app.listen(scraperConfig.apiHttpPort, '0.0.0.0');
  logger.log(`HTTP API endpoints are available on TCP port ${scraperConfig.apiHttpPort}.`);
}

void bootstrap();
