import { Injectable, Logger } from '@nestjs/common';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { PrepareSearchResultsUseCase } from 'application/usecases/scraper/prepare-search-results.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ExecuteScrapeNewPropertiesFlowUseCase {
  private readonly logger = new Logger(ExecuteScrapeNewPropertiesFlowUseCase.name);

  constructor(
    private readonly prepareSearchResultsUseCase: PrepareSearchResultsUseCase,
    private readonly propertyListingPaginationService: PropertyListingPaginationService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.prepareSearchResultsUseCase.execute(
      client,
      client.Page,
      client.Runtime
    );
    await this.propertyListingPaginationService.execute(client);
    this.logger.log('SCRAPING_FOR_NEW_PROPERTIES cycle finished.');
  }
}
