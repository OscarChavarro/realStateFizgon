import { Module } from '@nestjs/common';
import { RabbitMqModule } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ErrorMessageModule } from 'src/adapters/outbound/observability/error-message.module';
import { MongoDatabaseModule } from 'src/adapters/outbound/persistence/mongodb/mongo-database.module';
import { ImageDownloadModule } from 'src/application/services/imagedownload/image-download.module';
import { OriginErrorDetectorModule } from 'src/application/services/resilience/origin-error-detector.module';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { MarkPropertyClosedUseCase } from 'src/application/usecases/scraper/mark-property-closed.use-case';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { PublishNewPropertyNotificationUseCase } from 'src/application/usecases/imagedownload/publish-new-property-notification.use-case';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'src/application/usecases/scraper/process-discovered-property-urls.use-case';
import { ExtractAndEnrichPropertyDetailUseCase } from 'src/application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'src/application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'src/application/usecases/scraper/process-loaded-property-detail.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'src/application/usecases/scraper/revalidate-existing-property-urls.use-case';
import { LoadPropertyDetailFromResultsUseCase } from 'src/application/usecases/scraper/load-property-detail-from-results.use-case';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-property-detail-from-database.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [
    ConfigurationModule,
    OriginErrorDetectorModule,
    RabbitMqModule,
    ErrorMessageModule,
    MongoDatabaseModule,
    ImageDownloadModule
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
