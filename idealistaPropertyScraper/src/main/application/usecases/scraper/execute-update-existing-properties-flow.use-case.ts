import { Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { PrepareSearchResultsUseCase } from 'application/usecases/scraper/prepare-search-results.use-case';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'application/usecases/scraper/revalidate-properties-without-last-visit.use-case';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ExecuteUpdateExistingPropertiesFlowUseCase {
  private readonly logger = new Logger(ExecuteUpdateExistingPropertiesFlowUseCase.name);

  constructor(
    private readonly prepareSearchResultsUseCase: PrepareSearchResultsUseCase,
    private readonly revalidatePropertiesWithoutLastVisitUseCase: RevalidatePropertiesWithoutLastVisitUseCase,
    private readonly revalidateOpenPropertiesFromDatabaseUseCase: RevalidateOpenPropertiesFromDatabaseUseCase,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext): Promise<void> {
    await this.prepareSearchResultsUseCase.execute(
      client,
      client.Page,
      client.Runtime,
      scrapeRunContext
    );

    await this.revalidatePropertiesWithoutLastVisitUseCase.execute(client, scrapeRunContext);
    await this.revalidateOpenPropertiesFromDatabaseUseCase.execute(client, scrapeRunContext);
    this.logger.log('UPDATING_PROPERTIES cycle finished.');
  }
}
