import { Module } from '@nestjs/common';
import { SleepModule } from 'src/adapters/outbound/timing/sleep.module';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/scraper/paginate-and-process-listings.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperPropertyModule, SleepModule],
  providers: [PaginateAndProcessListingsUseCase, PropertyListingPaginationService],
  exports: [PropertyListingPaginationService]
})
export class ScraperPaginationModule {}
