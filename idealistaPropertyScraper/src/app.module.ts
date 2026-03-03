import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/config/configuration';
import { UpdatePropertiesController } from 'src/controllers/update-properties.controller';
import { ChromiumPageSyncService } from 'src/services/scraper/chromium-page-sync.service';
import { ChromiumFailureGuardService } from 'src/services/scraper/chromium-failure-guard.service';
import { ChromiumService } from 'src/services/scraper/chromium.service';
import { ChromiumProcessLiveCicleService } from 'src/services/scraper/chromium-process-live-cicle.service';
import { FilterLoaderDetectionService } from 'src/services/scraper/filters/filter-loader-detection.service';
import { FilterActionExecutorService } from 'src/services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractor } from 'src/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectionReaderService } from 'src/services/scraper/filters/filter-selection-reader.service';
import { FilterSelectedOptionExtractor } from 'src/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterTextNormalizationService } from 'src/services/scraper/filters/filter-text-normalization.service';
import { FilterUpdateService } from 'src/services/scraper/filters/filter-update.service';
import { FiltersService } from 'src/services/scraper/filters/filters.service';
import { MainPageService } from 'src/services/scraper/main-page.service';
import { SearchResultsPreparationService } from 'src/services/scraper/search-results-preparation.service';
import { PropertyListingPaginationService } from 'src/services/scraper/pagination/property-listing-pagination.service';
import { CookieAprovalDialogScraperService } from 'src/services/scraper/property/cookie-aproval-dialog-scraper.service';
import { DeactivatedDetailStatusService } from 'src/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailDomExtractorService } from 'src/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'src/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'src/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'src/services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from 'src/services/scraper/property/property-list-page.service';
import { RabbitMqService } from 'src/services/rabbitmq/rabbit-mq.service';
import { MongoDatabaseService } from 'src/services/mongodb/mongo-database.service';
import { ImageDownloader } from 'src/services/imagedownload/image-downloader';
import { ImageDownloadPathService } from 'src/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/services/imagedownload/image-url-rules.service';
import { ScraperStateMachineService } from 'src/states/scraper-state-machine.service';

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
