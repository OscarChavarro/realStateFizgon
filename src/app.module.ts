import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromeService } from './services/scraper/chrome.service';
import { FilterUpdateService } from './services/scraper/filter-update.service';
import { FiltersService } from './services/scraper/filters.service';
import { MainPageService } from './services/scraper/main-page.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, MainPageService, FilterUpdateService, FiltersService, ChromeService]
})
export class AppModule {}
