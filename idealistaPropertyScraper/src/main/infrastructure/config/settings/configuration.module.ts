import { Global, Module } from '@nestjs/common';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import { MongoConfig } from 'infrastructure/config/settings/mongo.config';
import { RabbitConfig } from 'infrastructure/config/settings/rabbit.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import { ENDPOINTS_AUTH_SETTINGS_PORT } from 'ports/outbound/settings/endpoints-auth-settings.port.token';
import { MONGO_SETTINGS_PORT } from 'ports/outbound/settings/mongo-settings.port.token';
import { RABBIT_SETTINGS_PORT } from 'ports/outbound/settings/rabbit-settings.port.token';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';

@Global()
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
    },
    {
      provide: MONGO_SETTINGS_PORT,
      useExisting: MongoConfig
    },
    {
      provide: RABBIT_SETTINGS_PORT,
      useExisting: RabbitConfig
    },
    {
      provide: ENDPOINTS_AUTH_SETTINGS_PORT,
      useExisting: ScraperConfig
    }
  ],
  exports: [
    ChromeConfig,
    MongoConfig,
    RabbitConfig,
    ScraperConfig,
    CHROME_SETTINGS_PORT,
    SCRAPER_SETTINGS_PORT,
    MONGO_SETTINGS_PORT,
    RABBIT_SETTINGS_PORT,
    ENDPOINTS_AUTH_SETTINGS_PORT
  ]
})
export class ConfigurationModule {}
