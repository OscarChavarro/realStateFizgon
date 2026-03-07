import { Module } from '@nestjs/common';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';
import { MongoConfig } from 'src/infrastructure/config/settings/mongo.config';
import { RabbitConfig } from 'src/infrastructure/config/settings/rabbit.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

@Module({
  providers: [ConfigurationSourceService, ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig],
  exports: [ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig]
})
export class ConfigurationModule {}
