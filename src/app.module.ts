import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromeService } from './services/scraper/chrome.service';
import { FilterLoaderDetectionService } from './services/scraper/filters/filter-loader-detection.service';
import { FilterUpdateService } from './services/scraper/filters/filter-update.service';
import { FiltersService } from './services/scraper/filters/filters.service';
import { MainPageService } from './services/scraper/main-page.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, MainPageService, FilterLoaderDetectionService, FilterUpdateService, FiltersService, ChromeService]
})
export class AppModule {}
