import { Module } from '@nestjs/common';
import { MongoDatabaseModule } from 'src/adapters/outbound/persistence/mongodb/mongo-database.module';
import { ImageDownloadModule } from 'src/application/services/imagedownload/image-download.module';
import { ScraperChromiumModule } from 'src/application/services/scraper/chromium/scraper-chromium.module';
import { ScraperFiltersModule } from 'src/application/services/scraper/filters/scraper-filters.module';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { OriginErrorDetectorModule } from 'src/application/services/scraper/origin-error-detector.module';
import { ScraperPaginationModule } from 'src/application/services/scraper/pagination/scraper-pagination.module';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ChromiumService } from 'src/application/services/scraper/chromium.service';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';

@Module({
  imports: [
    ConfigurationModule,
    ScraperChromiumModule,
    OriginErrorDetectorModule,
    ScraperFiltersModule,
    ScraperPropertyModule,
    ScraperPaginationModule,
    ScraperStateModule,
    MongoDatabaseModule,
    ImageDownloadModule
  ],
  providers: [
    MainPageService,
    SearchResultsPreparationService,
    ChromiumService
  ],
  exports: [ChromiumService]
})
export class ScraperOrchestrationModule {}
