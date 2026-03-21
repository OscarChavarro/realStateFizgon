import { Module } from '@nestjs/common';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { ScraperPropertyModule } from 'application/services/scraper/property/scraper-property.module';
import { PaginateAndProcessListingsUseCase } from 'application/usecases/scraper/paginate-and-process-listings.use-case';

@Module({
  imports: [ScraperPropertyModule],
  providers: [PaginateAndProcessListingsUseCase, PropertyListingPaginationService],
  exports: [PropertyListingPaginationService]
})
export class ScraperPaginationModule {}
