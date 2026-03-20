import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'app.module';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';

import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const scraperConfig = app.get<ScraperSettingsPort>(SCRAPER_SETTINGS_PORT);
  await app.listen(scraperConfig.apiHttpPort, '0.0.0.0');
  logger.log(`HTTP API endpoints are available on TCP port ${scraperConfig.apiHttpPort}.`);
}

void bootstrap();
