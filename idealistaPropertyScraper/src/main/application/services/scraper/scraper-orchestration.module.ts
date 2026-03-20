import { Module } from '@nestjs/common';
import { MongoDatabaseModule } from 'src/adapters/outbound/persistence/mongodb/mongo-database.module';
import { ImageDownloadModule } from 'src/application/services/imagedownload/image-download.module';
import { ScraperChromiumModule } from 'src/application/services/chromium/scraper-chromium.module';
import { ScraperFiltersModule } from 'src/application/services/scraper/filters/scraper-filters.module';
import { InfrastructurePreCheckService } from 'src/application/services/prechecks/infrastructure-pre-check.service';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { OriginErrorDetectorModule } from 'src/application/services/resilience/origin-error-detector.module';
import { ScraperPaginationModule } from 'src/application/services/scraper/pagination/scraper-pagination.module';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ScraperBootstrapService } from 'src/application/services/scraper/scraper-bootstrap.service';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';
import { HomeSearchPreparationFlowService } from 'src/application/services/bootstrap/home-search-preparation-flow.service';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';
import { BootstrapChromiumSessionUseCase } from 'src/application/usecases/bootstrap/bootstrap-chromium-session.use-case';
import { InitializeScraperBootstrapUseCase } from 'src/application/usecases/bootstrap/initialize-scraper-bootstrap.use-case';
import { ExecuteMainSearchFormUseCase } from 'src/application/usecases/scraper/execute-main-search-form.use-case';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-scrape-new-properties-flow.use-case';
import { ExecuteScrapeNewPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-scrape-new-properties-cycle.use-case';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { PrepareHomeSearchUseCase } from 'src/application/usecases/bootstrap/prepare-home-search.use-case';
import { RunScraperStateLoopUseCase } from 'src/application/usecases/state/run-scraper-state-loop.use-case';
import { PrepareSearchResultsUseCase } from 'src/application/usecases/scraper/prepare-search-results.use-case';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'src/application/usecases/scraper/revalidate-properties-without-last-visit.use-case';
import { RunStartupPreChecksUseCase } from 'src/application/usecases/prechecks/run-startup-pre-checks.use-case';

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
    BootstrapChromiumSessionUseCase,
    InitializeScraperBootstrapUseCase,
    ExecuteMainSearchFormUseCase,
    ExecuteScrapeNewPropertiesFlowUseCase,
    ExecuteScrapeNewPropertiesCycleUseCase,
    ExecuteUpdateExistingPropertiesFlowUseCase,
    ExecuteUpdateExistingPropertiesCycleUseCase,
    RevalidateOpenPropertiesFromDatabaseUseCase,
    RevalidatePropertiesWithoutLastVisitUseCase,
    PrepareHomeSearchUseCase,
    RunScraperStateLoopUseCase,
    PrepareSearchResultsUseCase,
    RunStartupPreChecksUseCase,
    MainPageService,
    SearchResultsPreparationService,
    ScraperBootstrapService
  ],
  exports: [ScraperBootstrapService]
})
export class ScraperOrchestrationModule {}
