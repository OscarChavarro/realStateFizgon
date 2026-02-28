import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromeService } from './services/scraper/chrome.service';
import { FilterLoaderDetectionService } from './services/scraper/filters/filter-loader-detection.service';
import { FilterUpdateService } from './services/scraper/filters/filter-update.service';
import { FiltersService } from './services/scraper/filters/filters.service';
import { MainPageService } from './services/scraper/main-page.service';
import { PropertyListingPaginationService } from './services/scraper/pagination/property-listing-pagination.service';
import { PropertyDetailPageService } from './services/scraper/property/property-detail-page.service';
import { PropertyListPageService } from './services/scraper/property/property-list-page.service';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { MongoDatabaseService } from './services/mongodb/mongo-database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [
    Configuration,
    MainPageService,
    FilterLoaderDetectionService,
    FilterUpdateService,
    FiltersService,
    RabbitMqService,
    MongoDatabaseService,
    PropertyDetailPageService,
    PropertyListPageService,
    PropertyListingPaginationService,
    ChromeService
  ]
})
export class AppModule {}
