import { Module } from '@nestjs/common';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { ScraperPropertyModule } from 'src/application/services/scraper/property/scraper-property.module';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/scraper/paginate-and-process-listings.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperPropertyModule],
  providers: [PaginateAndProcessListingsUseCase, PropertyListingPaginationService],
  exports: [PropertyListingPaginationService]
})
export class ScraperPaginationModule {}
