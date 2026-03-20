import { Module } from '@nestjs/common';
import { IdealistaCaptchaDetectorModule } from 'adapters/outbound/captcha/idealista-captcha-detector.module';
import { ProxyAccessValidatorModule } from 'adapters/outbound/network/proxy-access-validator.module';
import { ErrorMessageModule } from 'adapters/outbound/observability/error-message.module';
import { MongoDatabaseModule } from 'adapters/outbound/persistence/mongodb/mongo-database.module';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { ImageDownloadModule } from 'application/services/imagedownload/image-download.module';
import { ScraperChromiumModule } from 'application/services/chromium/scraper-chromium.module';
import { ScraperFiltersModule } from 'application/services/scraper/filters/scraper-filters.module';
import { OriginErrorDetectorModule } from 'application/services/resilience/origin-error-detector.module';
import { ScraperPaginationModule } from 'application/services/scraper/pagination/scraper-pagination.module';
import { ScraperPropertyModule } from 'application/services/scraper/property/scraper-property.module';
import { ScraperBootstrapService } from 'application/services/scraper/scraper-bootstrap.service';
import { ScraperStateModule } from 'application/services/state/scraper-state.module';
import { ScraperOrchestratorService } from 'application/services/scraper/scraper-orchestrator.service';
import { BootstrapChromiumSessionUseCase } from 'application/usecases/bootstrap/bootstrap-chromium-session.use-case';
import { HandleScraperBootstrapFailureUseCase } from 'application/usecases/bootstrap/handle-scraper-bootstrap-failure.use-case';
import { InitializeScraperBootstrapUseCase } from 'application/usecases/bootstrap/initialize-scraper-bootstrap.use-case';
import { ExecuteMainSearchFormUseCase } from 'application/usecases/scraper/execute-main-search-form.use-case';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'application/usecases/scraper/execute-scrape-new-properties-flow.use-case';
import { ExecuteScrapeNewPropertiesCycleUseCase } from 'application/usecases/chromium/execute-scrape-new-properties-cycle.use-case';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { PrepareHomeSearchUseCase } from 'application/usecases/bootstrap/prepare-home-search.use-case';
import { RunScraperStateLoopUseCase } from 'application/usecases/state/run-scraper-state-loop.use-case';
import { PrepareSearchResultsUseCase } from 'application/usecases/scraper/prepare-search-results.use-case';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'application/usecases/scraper/revalidate-properties-without-last-visit.use-case';
import { RunStartupPreChecksUseCase } from 'application/usecases/prechecks/run-startup-pre-checks.use-case';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { ValidateImageDownloadFolderPreCheckUseCase } from 'application/usecases/prechecks/validate-image-download-folder-pre-check.use-case';
import { ValidateProxyAccessPreCheckUseCase } from 'application/usecases/prechecks/validate-proxy-access-pre-check.use-case';

@Module({
  imports: [
    ScraperChromiumModule,
    OriginErrorDetectorModule,
    ScraperFiltersModule,
    ScraperPropertyModule,
    ScraperPaginationModule,
    ScraperStateModule,
    MongoDatabaseModule,
    ImageDownloadModule,
    ErrorMessageModule,
    SleepModule,
    IdealistaCaptchaDetectorModule,
    ProxyAccessValidatorModule
  ],
  providers: [
    ScraperOrchestratorService,
    BootstrapChromiumSessionUseCase,
    HandleScraperBootstrapFailureUseCase,
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
    ValidatePersistenceConnectionPreCheckUseCase,
    ValidateImageDownloadFolderPreCheckUseCase,
    ValidateProxyAccessPreCheckUseCase,
    ScraperBootstrapService
  ],
  exports: [ScraperBootstrapService]
})
export class ScraperOrchestrationModule {}
