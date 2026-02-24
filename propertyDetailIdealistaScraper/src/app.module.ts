import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromeService } from './services/scraper/chrome.service';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { PropertyDetailPageService } from './services/scraper/property/property-detail-page.service';
import { MongoDatabaseService } from './services/mongodb/mongo-database.service';
import { ImageDownloader } from './services/imagedownload/image-downloader';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, RabbitMqService, MongoDatabaseService, ImageDownloader, PropertyDetailPageService, ChromeService]
})
export class AppModule {}
