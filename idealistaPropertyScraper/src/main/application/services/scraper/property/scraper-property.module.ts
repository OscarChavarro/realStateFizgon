import { Module } from '@nestjs/common';
import { IdealistaCaptchaDetectorModule } from 'adapters/outbound/captcha/idealista-captcha-detector.module';
import { RabbitMqModule } from 'adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ErrorMessageModule } from 'adapters/outbound/observability/error-message.module';
import { MongoDatabaseModule } from 'adapters/outbound/persistence/mongodb/mongo-database.module';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { ImageDownloadModule } from 'application/services/imagedownload/image-download.module';
import { OriginErrorDetectorModule } from 'application/services/resilience/origin-error-detector.module';
import { CookieApprovalDialogScraperService } from 'application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { DeactivatedDetailStatusService } from 'application/services/scraper/property/deactivated-detail-status.service';
import { GeoCoordinateHintService } from 'application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'application/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'application/services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { MarkPropertyClosedUseCase } from 'application/usecases/scraper/mark-property-closed.use-case';
import { PersistPropertyDetailAndAssetsUseCase } from 'application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { PublishNewPropertyNotificationUseCase } from 'application/usecases/imagedownload/publish-new-property-notification.use-case';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { ExtractAndEnrichPropertyDetailUseCase } from 'application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'application/usecases/scraper/process-loaded-property-detail.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'application/usecases/scraper/revalidate-existing-property-urls.use-case';
import { LoadPropertyDetailFromResultsUseCase } from 'application/usecases/scraper/load-property-detail-from-results.use-case';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'application/usecases/scraper/revalidate-property-detail-from-database.use-case';

@Module({
  imports: [
    OriginErrorDetectorModule,
    RabbitMqModule,
    ErrorMessageModule,
    MongoDatabaseModule,
    ImageDownloadModule,
    IdealistaCaptchaDetectorModule,
    SleepModule
  ],
  providers: [
    CookieApprovalDialogScraperService,
    DeactivatedDetailStatusService,
    GeoCoordinateHintService,
    PropertyDetailNavigationService,
    PropertyDetailInteractionService,
    PropertyDetailDomExtractorService,
    MarkPropertyClosedUseCase,
    PublishNewPropertyNotificationUseCase,
    PersistPropertyDetailAndAssetsUseCase,
    ProcessDiscoveredPropertyUrlsUseCase,
    ExtractAndEnrichPropertyDetailUseCase,
    HandleDeactivatedPropertyDetailUseCase,
    ProcessLoadedPropertyDetailUseCase,
    RevalidateExistingPropertyUrlsUseCase,
    LoadPropertyDetailFromResultsUseCase,
    RevalidatePropertyDetailFromDatabaseUseCase,
    PropertyDetailStorageService,
    PropertyDetailPageService,
    PropertyListPageService
  ],
  exports: [PropertyListPageService]
})
export class ScraperPropertyModule {}
