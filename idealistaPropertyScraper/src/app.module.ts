import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/infrastructure/config/configuration';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { ChromiumPageSyncService } from 'src/application/services/scraper/chromium-page-sync.service';
import { ChromiumFailureGuardService } from 'src/application/services/scraper/chromium-failure-guard.service';
import { ChromiumService } from 'src/application/services/scraper/chromium.service';
import { ChromiumProcessLiveCicleService } from 'src/application/services/scraper/chromium-process-live-cicle.service';
import { FilterLoaderDetectionService } from 'src/application/services/scraper/filters/filter-loader-detection.service';
import { FilterActionExecutorService } from 'src/application/services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractor } from 'src/application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectionReaderService } from 'src/application/services/scraper/filters/filter-selection-reader.service';
import { FilterSelectedOptionExtractor } from 'src/application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterTextNormalizationService } from 'src/application/services/scraper/filters/filter-text-normalization.service';
import { FilterUpdateService } from 'src/application/services/scraper/filters/filter-update.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { CookieAprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-aproval-dialog-scraper.service';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { RabbitMqService } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [
    UpdatePropertiesController
  ],
  providers: [
    Configuration,
    ScraperStateMachineService,
    ChromiumPageSyncService,
    ChromiumFailureGuardService,
    ChromiumProcessLiveCicleService,
    SearchResultsPreparationService,
    MainPageService,
    FilterLoaderDetectionService,
    FilterAvailableOptionExtractor,
    FilterSelectedOptionExtractor,
    FilterTextNormalizationService,
    FilterSelectionReaderService,
    FilterActionExecutorService,
    FilterUpdateService,
    FiltersService,
    RabbitMqService,
    MongoDatabaseService,
    ImageDownloadPathService,
    ImageUrlRulesService,
    ImageFileNameService,
    ImageNetworkCaptureService,
    ImagePendingQueuePublisherService,
    ImageDownloader,
    CookieAprovalDialogScraperService,
    DeactivatedDetailStatusService,
    PropertyDetailNavigationService,
    PropertyDetailInteractionService,
    PropertyDetailDomExtractorService,
    PropertyDetailStorageService,
    PropertyDetailPageService,
    PropertyListPageService,
    PropertyListingPaginationService,
    ChromiumService
  ]
})
export class AppModule {}
