import { Module } from '@nestjs/common';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import { MongoConfig } from 'infrastructure/config/settings/mongo.config';
import { RabbitConfig } from 'infrastructure/config/settings/rabbit.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';

@Module({
  providers: [
    ConfigurationSourceService,
    ChromeConfig,
    MongoConfig,
    RabbitConfig,
    ScraperConfig,
    {
      provide: CHROME_SETTINGS_PORT,
      useExisting: ChromeConfig
    },
    {
      provide: SCRAPER_SETTINGS_PORT,
      useExisting: ScraperConfig
    }
  ],
  exports: [ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig, CHROME_SETTINGS_PORT, SCRAPER_SETTINGS_PORT]
})
export class ConfigurationModule {}
