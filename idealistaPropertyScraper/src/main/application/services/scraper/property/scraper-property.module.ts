import { Module } from '@nestjs/common';
import { MongoDatabaseModule } from 'src/adapters/outbound/persistence/mongodb/mongo-database.module';
import { ImageDownloadModule } from 'src/application/services/imagedownload/image-download.module';
import { OriginErrorDetectorModule } from 'src/application/services/resilience/origin-error-detector.module';
import { CookieApprovalDialogScraperService } from 'src/application/services/scraper/property/cookie-approval-dialog-scraper.service';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyDetailInteractionService } from 'src/application/services/scraper/property/property-detail-interaction.service';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [
    ConfigurationModule,
    OriginErrorDetectorModule,
    MongoDatabaseModule,
    ImageDownloadModule
  ],
  providers: [
    CookieApprovalDialogScraperService,
    DeactivatedDetailStatusService,
    PropertyDetailNavigationService,
    PropertyDetailInteractionService,
    PropertyDetailDomExtractorService,
    PropertyDetailStorageService,
    PropertyDetailPageService,
    PropertyListPageService
  ],
  exports: [PropertyListPageService]
})
export class ScraperPropertyModule {}
