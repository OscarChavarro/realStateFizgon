import { Module } from '@nestjs/common';
import { MongoDatabaseModule } from 'src/adapters/outbound/persistence/mongodb/mongo-database.module';
import { ImageDownloadModule } from 'src/application/services/imagedownload/image-download.module';
import { ScraperChromiumModule } from 'src/application/services/scraper/chromium/scraper-chromium.module';
import { ScraperFiltersModule } from 'src/application/services/scraper/filters/scraper-filters.module';
import { InfrastructurePreCheckService } from 'src/application/services/scraper/infrastructure-pre-check.service';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { OriginErrorDetectorModule } from 'src/application/services/scraper/origin-error-detector.module';
import { ScraperPaginationModule } from 'src/application/services/scraper/pagination/scraper-pagination.module';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ScraperBootstrapService } from 'src/application/services/scraper/scraper-bootstrap.service';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';
import { HomeSearchPreparationFlowService } from 'src/application/services/scraper/flows/home-search-preparation-flow.service';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';

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
    InfrastructurePreCheckService,
    HomeSearchPreparationFlowService,
    ScrapeNewPropertiesFlowService,
    ScraperOrchestratorService,
    UpdateExistingPropertiesFlowService,
    MainPageService,
    SearchResultsPreparationService,
    ScraperBootstrapService
  ],
  exports: [ScraperBootstrapService]
})
export class ScraperOrchestrationModule {}
