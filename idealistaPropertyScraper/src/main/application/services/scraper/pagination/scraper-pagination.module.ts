import { Module } from '@nestjs/common';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperPropertyModule],
  providers: [PropertyListingPaginationService],
  exports: [PropertyListingPaginationService]
})
export class ScraperPaginationModule {}
