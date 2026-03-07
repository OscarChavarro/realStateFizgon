import { Module } from '@nestjs/common';
import { ChromeConfig } from 'src/infrastructure/config/chrome.config';
import { ConfigurationSourceService } from 'src/infrastructure/config/configuration-source.service';
import { MongoConfig } from 'src/infrastructure/config/mongo.config';
import { RabbitConfig } from 'src/infrastructure/config/rabbit.config';
import { ScraperConfig } from 'src/infrastructure/config/scraper.config';

@Module({
  providers: [ConfigurationSourceService, ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig],
  exports: [ChromeConfig, MongoConfig, RabbitConfig, ScraperConfig]
})
export class ConfigurationModule {}
