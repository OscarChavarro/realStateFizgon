import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromiumPageSyncService } from './services/scraper/chromium-page-sync.service';
import { ChromiumService } from './services/scraper/chromium.service';
import { ChromiumProcessLiveCicleService } from './services/scraper/chromium-process-live-cicle.service';
import { FilterLoaderDetectionService } from './services/scraper/filters/filter-loader-detection.service';
import { FilterActionExecutorService } from './services/scraper/filters/filter-action-executor.service';
import { FilterAvailableOptionExtractor } from './services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectionReaderService } from './services/scraper/filters/filter-selection-reader.service';
import { FilterSelectedOptionExtractor } from './services/scraper/filters/filter-selected-option-extractor.service';
import { FilterTextNormalizationService } from './services/scraper/filters/filter-text-normalization.service';
import { FilterUpdateService } from './services/scraper/filters/filter-update.service';
import { FiltersService } from './services/scraper/filters/filters.service';
import { MainPageService } from './services/scraper/main-page.service';
import { PropertyListingPaginationService } from './services/scraper/pagination/property-listing-pagination.service';
import { CookieAprovalDialogScraperService } from './services/scraper/property/cookie-aproval-dialog-scraper.service';
import { PropertyDetailDomExtractorService } from './services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from './services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from './services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from './services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from './services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from './services/scraper/property/property-list-page.service';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { MongoDatabaseService } from './services/mongodb/mongo-database.service';
import { ImageDownloader } from './services/imagedownload/image-downloader';
import { ImageDownloadPathService } from './services/imagedownload/image-download-path.service';
import { ImageFileNameService } from './services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from './services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from './services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from './services/imagedownload/image-url-rules.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [
    Configuration,
    ChromiumPageSyncService,
    ChromiumProcessLiveCicleService,
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
