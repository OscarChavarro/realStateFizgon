import { Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'src/application/usecases/scraper/revalidate-properties-without-last-visit.use-case';

import type { ScraperCdpClient } from 'src/ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ExecuteUpdateExistingPropertiesFlowUseCase {
  private readonly logger = new Logger(ExecuteUpdateExistingPropertiesFlowUseCase.name);

  constructor(
    private readonly searchResultsPreparationService: SearchResultsPreparationService,
    private readonly revalidatePropertiesWithoutLastVisitUseCase: RevalidatePropertiesWithoutLastVisitUseCase,
    private readonly revalidateOpenPropertiesFromDatabaseUseCase: RevalidateOpenPropertiesFromDatabaseUseCase,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.searchResultsPreparationService.prepareSearchResultsWithFilters(
      client,
      client.Page,
      client.Runtime
    );

    this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
    await this.revalidatePropertiesWithoutLastVisitUseCase.execute(client);
    await this.revalidateOpenPropertiesFromDatabaseUseCase.execute(client);
    this.logger.log('UPDATING_PROPERTIES cycle finished.');
  }
}
