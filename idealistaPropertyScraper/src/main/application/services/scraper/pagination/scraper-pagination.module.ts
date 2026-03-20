import { Module } from '@nestjs/common';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { ScraperPropertyModule } from 'application/services/scraper/property/scraper-property.module';
import { PaginateAndProcessListingsUseCase } from 'application/usecases/scraper/paginate-and-process-listings.use-case';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperPropertyModule, SleepModule],
  providers: [PaginateAndProcessListingsUseCase, PropertyListingPaginationService],
  exports: [PropertyListingPaginationService]
})
export class ScraperPaginationModule {}
