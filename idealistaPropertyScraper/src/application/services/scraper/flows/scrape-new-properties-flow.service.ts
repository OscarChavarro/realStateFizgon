import { Injectable, Logger } from '@nestjs/common';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';

@Injectable()
export class ScrapeNewPropertiesFlowService {
  private readonly logger = new Logger(ScrapeNewPropertiesFlowService.name);

  constructor(
    private readonly searchResultsPreparationService: SearchResultsPreparationService,
    private readonly propertyListingPaginationService: PropertyListingPaginationService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.searchResultsPreparationService.prepareSearchResultsWithFilters(
      client,
      client.Page,
      client.Runtime
    );
    await this.propertyListingPaginationService.execute(client);
    this.logger.log('SCRAPING_FOR_NEW_PROPERTIES cycle finished.');
  }
}
