import { Module } from '@nestjs/common';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ConfigurationSourceService } from 'infrastructure/config/settings/configuration-source.service';
import { MongoConfig } from 'infrastructure/config/settings/mongo.config';
import { RabbitConfig } from 'infrastructure/config/settings/rabbit.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

@Module({
  providers: [ConfigurationSourceService, ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig],
  exports: [ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig]
})
export class ConfigurationModule {}
